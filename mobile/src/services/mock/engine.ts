import type { CartLine, Fixture, Order, Player, QueueItem, Role, ScreenData } from '../../types/preview';
import { demoAccounts, seedDatasets } from './seed';

export type Actor = { userId: string; role: Role; tenantId: string; clubId?: string | null; playerId?: string | null; leagueIds: string[] };
export type Command =
  | { kind: 'score'; matchId: string; eventType: 'score'|'match_start'|'match_end'|'compensation'; teamId?: string; scoringEvent?: string; targetId?: string; reason?: string }
  | { kind: 'roster'; playerId: string; action: 'transfer'|'loan'|'release'; toSquadId?: string; effectiveDate: string; loanEndDate?: string; reason: string }
  | { kind: 'addPlayer'; name: string; position: string; squadId: string; role: string }
  | { kind: 'editPlayer'; playerId: string; name: string; position: string }
  | { kind: 'playerRole'; playerId: string; role: string }
  | { kind: 'pin'; matchId: string; productId?: string }
  | { kind: 'checkout'; lines: CartLine[]; discount: string; payment: string }
  | { kind: 'orderTransition'; orderId: string; to: string }
  | { kind: 'league'; name: string; sportId: string; format: string }
  | { kind: 'structure'; leagueId: string; category: 'season'|'division'|'stage'; name: string; startDate?: string; endDate?: string; promotion?: number; relegation?: number; format?: string }
  | { kind: 'generate'; leagueId: string; teamIds: string[]; format: string }
  | { kind: 'schedule'; matchId: string; date: string; venue: string }
  | { kind: 'status'; matchId: string; status: string; reason: string }
  | { kind: 'product'; productId?: string; variantId?: string; name: string; category: string; clubId: string; size: string; color: string; price: number; stock: number }
  | { kind: 'price'; productId: string; variantId: string; price: number; effectiveDate: string }
  | { kind: 'tenant'; name: string; primary: string; secondary: string }
  | { kind: 'sport'; name: string; event: string; points: number };
export type ConfigEntry = { id: string; leagueId?: string; category: string; name: string; detail: string; effectiveDate?: string; productId?: string; variantId?: string; price?: number };
export type PendingAction = { actor: Actor; command: Command; request: { action_id: string; type: 'score_event'|'roster_transfer'; queued_at: string; base_version: number; payload: Record<string, unknown> }; label: string };
export type MockWorld = { version: 1; leagueOwners: Record<string,string>; datasets: Record<string, ScreenData>; pending: PendingAction[]; outcomes: (QueueItem & { userId: string; tenantId: string })[]; processed: string[]; carts: Record<string, CartLine[]>; configs: Record<string, ConfigEntry[]>; deferred: { tenantId: string; command: Extract<Command,{kind:'roster'}>; actor: Actor; id: string }[] };
export type Result = { ok: true; world: MockWorld; id?: string; queued?: boolean; message: string } | { ok: false; code: string; message: string };
export const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
export const createWorld = (): MockWorld => ({ version:1, leagueOwners:{}, datasets:seedDatasets(), pending:[], outcomes:[], processed:[], carts:{}, configs:{}, deferred:[] });
export function actorFor(role: Role, tenantId?: string): Actor {
  const user = demoAccounts.find(x => x.role === role)!;
  return { userId:user.user_id, role, tenantId:role==='super_admin'?(tenantId || 'tenant-alpha'):user.tenant_id!, clubId:user.club_id, playerId:user.player_id, leagueIds:user.league_ids };
}
export const scopeKey = (actor: Actor) => `${actor.userId}:${actor.tenantId}`;
export function dataFor(world: MockWorld, actor: Actor): ScreenData {
  const data = clone(world.datasets[actor.tenantId]);
  if (!data) throw new Error('Organization context is unavailable.');
  const user = demoAccounts.find(x => x.user_id === actor.userId)!;
  data.user = { ...user, league_ids:[...user.league_ids,...Object.entries(world.leagueOwners).filter(([,owner])=>owner===actor.userId).map(([league])=>league)] };
  data.players = [...data.players.filter(x => !data.clubs.some(c => c.roster.some(p => p.player_id===x.player_id))), ...data.clubs.flatMap(x => x.roster)];
  data.orders = data.orders.filter(x => actor.role==='super_admin'||x.customer_id===actor.userId||(actor.role==='club_manager'&&x.club_id===actor.clubId));
  data.queue = [...world.pending.filter(x => x.actor.userId===actor.userId&&x.actor.tenantId===actor.tenantId).map(x => ({ action_id:x.request.action_id,label:x.label,queued_at:x.request.queued_at,status:'pending' as const })), ...world.outcomes.filter(x => x.userId===actor.userId&&x.tenantId===actor.tenantId)];
  return data;
}
class MockError extends Error { constructor(public code: string, message: string) { super(message); } }
function requireRule(value: unknown, code: string, message: string): asserts value { if (!value) throw new MockError(code,message); }
const roles = ['captain','vice_captain','starter','substitute'];
const manager = (actor: Actor, clubId?: string) => actor.role==='super_admin'||(actor.role==='club_manager'&&clubId===actor.clubId);
const organizer = (actor: Actor, leagueId: string) => actor.role==='super_admin'||(actor.role==='league_organizer'&&actor.leagueIds.includes(leagueId));
export function validDate(value: string) { const date=new Date(`${value}T00:00:00Z`); return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(date.valueOf())&&date.toISOString().slice(0,10)===value; }
function text(value: string, label: string) { requireRule(value.trim().length>0&&value.trim().length<=200,'VALIDATION_ERROR',`${label} must contain 1–200 characters.`); }
function playerIn(data: ScreenData, id: string) {
  const club = data.clubs.find(x => x.roster.some(p => p.player_id===id));
  const player = club?.roster.find(p => p.player_id===id) || data.players.find(p => p.player_id===id);
  requireRule(player,'PLAYER_NOT_FOUND','This player is no longer available. Refresh the roster.'); return { club,player };
}
function matchIn(data: ScreenData, id: string) { const match=data.fixtures.find(x=>x.match_id===id);requireRule(match,'MATCH_NOT_FOUND','This match could not be found.');return match; }
function assertManage(actor: Actor, match: Fixture) { requireRule(organizer(actor,match.league_id),'FORBIDDEN','Only the organizer of this competition can change the match.'); }
function activeRosterMatch(data: ScreenData, player: Player) {
  // Explicit synthetic team/squad relationship, stored as mock configuration.
  return data.fixtures.some(x => x.status==='in_progress' && data.teamLinks?.some(s => s.squad_id===player.squad_id&&[x.home_team_id,x.away_team_id].includes(s.team_id)));
}
function projectMatch(data: ScreenData, match: Fixture) {
  const events=match.events||[]; const compensated=new Set(events.filter(x=>x.type==='compensation').map(x=>String(x.payload.compensates)));
  let home=0,away=0;
  for (const event of events) {
    event.compensated=compensated.has(event.event_id);
    if(event.type!=='score'||event.compensated)continue;
    const points=data.eventTypes.find(x=>x.value===event.payload.event_type)?.points || 1;
    if(event.payload.team_id===match.home_team_id)home+=points;else if(event.payload.team_id===match.away_team_id)away+=points;
  }
  match.score={home,away};match.version=events.length;
}
function projectStandings(data: ScreenData, leagueId: string) {
  const matches=data.fixtures.filter(x=>x.league_id===leagueId);
  const ids=[...new Set(matches.flatMap(x=>[x.home_team_id,x.away_team_id]))];
  const rows=ids.map(id=>{const played=matches.filter(x=>x.status==='completed'&&[x.home_team_id,x.away_team_id].includes(id));let won=0,drawn=0,lost=0,scored=0,conceded=0;
    for(const match of played){const own=match.home_team_id===id?match.score.home:match.score.away;const other=match.home_team_id===id?match.score.away:match.score.home;scored+=own||0;conceded+=other||0;if(own===other)drawn++;else if((own||0)>(other||0))won++;else lost++;}
    const sample=matches.find(x=>x.home_team_id===id||x.away_team_id===id);return {team_id:id,name:sample?.home_team_id===id?sample.home_name:sample?.away_name,rank:0,played:played.length,won,drawn,lost,points:won*3+drawn,status:'still_possible',scored,conceded};});
  rows.sort((a,b)=>b.points-a.points||(b.scored-b.conceded)-(a.scored-a.conceded)||b.scored-a.scored||a.team_id.localeCompare(b.team_id));
  rows.forEach((row,index)=>{row.rank=index+1;if(matches.every(x=>x.status==='completed'))row.status=index===0?'clinched':'eliminated';});
  data.standings[leagueId]=rows;
}
function applyRoster(world: MockWorld, data: ScreenData, actor: Actor, cmd: Extract<Command,{kind:'roster'}>, id: string, now: string, replayDeferred=false) {
  const {club,player}=playerIn(data,cmd.playerId);
  requireRule(manager(actor,club?.club_id),'FORBIDDEN','You can change registrations only for your own club.');
  requireRule(player.squad_id,'PLAYER_NOT_REGISTERED','This player has no active squad registration.');
  requireRule(validDate(cmd.effectiveDate),'VALIDATION_ERROR','Enter a valid effective date.');
  text(cmd.reason,'Reason');
  requireRule(!player.on_loan,'PLAYER_ON_LOAN','A player on loan cannot be moved until the loan ends.');
  const destination=data.squads?.find(x=>x.squad_id===cmd.toSquadId);
  if(cmd.action!=='release'){
    requireRule(destination,'SQUAD_NOT_FOUND','Choose a destination squad.');
    const source=data.squads?.find(x=>x.squad_id===player.squad_id);
    requireRule(destination.squad_id!==player.squad_id&&destination.league_id===source?.league_id,'VALIDATION_ERROR','Choose another squad in the same competition.');
    requireRule(data.clubs.flatMap(x=>x.roster).filter(x=>x.squad_id===destination.squad_id).length<25,'SQUAD_FULL','That squad is already full.');
  }
  if(cmd.action==='loan')requireRule(cmd.loanEndDate&&validDate(cmd.loanEndDate)&&cmd.loanEndDate>cmd.effectiveDate,'VALIDATION_ERROR','The loan must end after its effective date.');
  const deferred=!replayDeferred&&(activeRosterMatch(data,player)||cmd.effectiveDate>now.slice(0,10));
  if(!replayDeferred){(data.history[player.player_id] ||= []).push({audit_id:id,action:cmd.action,effective_date:cmd.effectiveDate,who:actor.userId,why:cmd.reason.trim(),state:deferred?'deferred_until_match_end':'active'});}
  if(deferred){world.deferred.push({tenantId:actor.tenantId,command:cmd,actor,id});return true;}
  club!.roster=club!.roster.filter(x=>x.player_id!==player.player_id);
  player.squad_id=cmd.action==='release'?undefined:destination!.squad_id;
  player.role='substitute';player.on_loan=cmd.action==='loan';player.club_id=cmd.action==='release'?undefined:destination!.club_id;
  data.players=data.players.filter(x=>x.player_id!==player.player_id);
  if(player.club_id)data.clubs.find(x=>x.club_id===player.club_id)!.roster.push(player);else data.players.push(player);
  return false;
}
function apply(world: MockWorld, actor: Actor, cmd: Command, id: string, now: string): {id?:string;message:string} {
  const data=world.datasets[actor.tenantId];requireRule(data,'FORBIDDEN','Choose an available organization.');
  if(cmd.kind==='score'){
    const match=matchIn(data,cmd.matchId);assertManage(actor,match);
    if(cmd.eventType==='match_start')requireRule(match.status==='upcoming','ILLEGAL_TRANSITION','Only an upcoming match can be started.');
    else if(cmd.eventType==='match_end'||cmd.eventType==='score')requireRule(match.status==='in_progress','MATCH_NOT_IN_PROGRESS','This match must be in progress first.');
    const payload:Record<string,unknown>={};let label=cmd.eventType.replace(/_/g,' ');
    if(cmd.eventType==='score'){
      requireRule([match.home_team_id,match.away_team_id].includes(cmd.teamId||''),'INVALID_TEAM','Choose one of this match’s teams.');
      requireRule(data.eventTypes.some(x=>x.value===cmd.scoringEvent),'INVALID_EVENT_TYPE','Choose an event from the sport configuration.');
      payload.team_id=cmd.teamId;payload.event_type=cmd.scoringEvent;label=`${data.eventTypes.find(x=>x.value===cmd.scoringEvent)!.label} · ${cmd.teamId===match.home_team_id?match.home_name:match.away_name}`;
    }
    if(cmd.eventType==='compensation'){
      const target=match.events?.find(x=>x.event_id===cmd.targetId);requireRule(target&&!target.compensated&&['score','discipline','tiebreak_winner'].includes(target.type),'INVALID_COMPENSATION','Choose an original event that has not already been corrected.');
      text(cmd.reason||'','Reason');payload.compensates=cmd.targetId;payload.reason=cmd.reason;label='Event corrected';
    }
    (match.events ||= []).push({event_id:id,sequence:match.events!.length+1,type:cmd.eventType,payload,compensated:false,label});
    if(cmd.eventType==='match_start')match.status='in_progress';if(cmd.eventType==='match_end')match.status='completed';
    projectMatch(data,match);projectStandings(data,match.league_id);
    if(cmd.eventType==='match_end')settleDeferred(world,now);
    return {id:match.match_id,message:'Match updated. The timeline and table are refreshed.'};
  }
  if(cmd.kind==='roster'){const deferred=applyRoster(world,data,actor,cmd,id,now);return {id:cmd.playerId,message:deferred?'Accepted. This change takes effect after active matches end and its effective date arrives.':'Registration updated. The change is recorded in player history.'};}
  if(cmd.kind==='addPlayer'){
    const squad=data.squads?.find(x=>x.squad_id===cmd.squadId);requireRule(squad,'SQUAD_NOT_FOUND','Choose a squad.');requireRule(manager(actor,squad.club_id),'FORBIDDEN','You can add players only to your own club.');text(cmd.name,'Name');text(cmd.position,'Position');requireRule(roles.includes(cmd.role),'VALIDATION_ERROR','Choose a player role.');
    const club=data.clubs.find(x=>x.club_id===squad.club_id)!;requireRule(club.roster.filter(x=>x.squad_id===squad.squad_id).length<25,'SQUAD_FULL','That squad is already full.');
    if(['captain','vice_captain'].includes(cmd.role))requireRule(!club.roster.some(x=>x.squad_id===cmd.squadId&&x.role===cmd.role),'ROLE_ALREADY_ASSIGNED','This squad already has that leadership role.');
    club.roster.push({player_id:id,name:cmd.name.trim(),position:cmd.position.trim(),squad_id:cmd.squadId,role:cmd.role,on_loan:false,club_id:club.club_id});return {id,message:'Player added to the squad.'};
  }
  if(cmd.kind==='editPlayer'||cmd.kind==='playerRole'){
    const {club,player}=playerIn(data,cmd.playerId);const allowed=manager(actor,club?.club_id)||(cmd.kind==='editPlayer'&&actor.role==='player'&&actor.playerId===cmd.playerId);
    requireRule(allowed,'FORBIDDEN','You do not have permission to edit this player.');
    if(cmd.kind==='editPlayer'){text(cmd.name,'Name');text(cmd.position,'Position');player.name=cmd.name.trim();player.position=cmd.position.trim();}
    else {requireRule(roles.includes(cmd.role),'VALIDATION_ERROR','Choose a valid role.');requireRule(!['captain','vice_captain'].includes(cmd.role)||!club?.roster.some(x=>x.player_id!==player.player_id&&x.squad_id===player.squad_id&&x.role===cmd.role),'ROLE_ALREADY_ASSIGNED','This squad already has that leadership role.');player.role=cmd.role;}
    return {message:'Player details saved.'};
  }
  if(cmd.kind==='pin'){const match=matchIn(data,cmd.matchId);assertManage(actor,match);const product=data.products.find(x=>x.product_id===cmd.productId);requireRule(!cmd.productId||product,'PRODUCT_NOT_FOUND','Choose an available product.');match.pinned_product=product||null;return {message:product?'Product featured on the match page.':'Featured product removed.'};}
  if(cmd.kind==='checkout'){
    requireRule(cmd.lines.length>0,'VALIDATION_ERROR','Your cart is empty.');requireRule(new Set(cmd.lines.map(x=>x.variant.variant_id)).size===cmd.lines.length,'VALIDATION_ERROR','Combine duplicate variants before checkout.');
    requireRule(!cmd.discount.trim()||cmd.discount.trim().toUpperCase()==='WELCOME10','INVALID_DISCOUNT','This discount code is not valid.');
    const items=cmd.lines.map(line=>{const product=data.products.find(x=>x.variants.some(v=>v.variant_id===line.variant.variant_id));const variant=product?.variants.find(v=>v.variant_id===line.variant.variant_id);requireRule(variant,'VARIANT_NOT_FOUND','An item is no longer available.');requireRule(Number.isInteger(line.quantity)&&line.quantity>=1&&line.quantity<=10,'VALIDATION_ERROR','Quantities must be between 1 and 10.');requireRule(variant.stock>=line.quantity,'OUT_OF_STOCK',`${product!.name} does not have enough stock. Update your cart.`);return {variant_id:variant.variant_id,name:product!.name,quantity:line.quantity,unit_price_minor:variant.price_minor};});
    requireRule(cmd.payment==='tok_success',cmd.payment==='tok_declined'?'PAYMENT_DECLINED':'PAYMENT_FAILED','The mock payment was unsuccessful. Your cart and stock are unchanged.');
    const subtotal=items.reduce((sum,x)=>sum+x.quantity*x.unit_price_minor,0);const discount=cmd.discount.trim()?Math.floor(subtotal/10):0;
    for(const item of items){const variant=data.products.flatMap(x=>x.variants).find(x=>x.variant_id===item.variant_id)!;variant.stock-=item.quantity;}
    const product=data.products.find(x=>x.variants.some(v=>v.variant_id===items[0].variant_id));
    const order:Order={order_id:id,customer_id:actor.userId,club_id:items.every(item=>data.products.find(x=>x.variants.some(v=>v.variant_id===item.variant_id))?.club_id===product?.club_id)?product?.club_id:undefined,status:'paid',created_at:now,paid_at:now,currency:'PKR',items,subtotal_minor:subtotal,discount_minor:discount,total_minor:subtotal-discount};
    data.orders.unshift(order);world.carts[scopeKey(actor)]=[];return {id,message:'Mock payment confirmed. Your receipt is ready.'};
  }
  if(cmd.kind==='orderTransition'){
    const order=data.orders.find(x=>x.order_id===cmd.orderId);requireRule(order,'ORDER_NOT_FOUND','This order is unavailable.');requireRule(manager(actor,order.club_id),'FORBIDDEN','Only the order’s club manager can change fulfillment.');
    const transitions:Record<string,string[]>={pending:['cancelled'],paid:['packed','cancelled','refunded'],packed:['shipped','cancelled','refunded'],shipped:['delivered','refunded'],delivered:['refunded']};
    requireRule(transitions[order.status]?.includes(cmd.to),'ILLEGAL_TRANSITION','That change is not available for the current order status.');
    if(['cancelled','refunded'].includes(cmd.to)&&!['shipped','delivered'].includes(order.status))for(const item of order.items){const variant=data.products.flatMap(x=>x.variants).find(x=>x.variant_id===item.variant_id);if(variant)variant.stock+=item.quantity;}
    (world.configs[actor.tenantId] ||= []).push({id,category:'order_status',name:order.order_id,detail:`${order.status} → ${cmd.to} · ${now}`});order.status=cmd.to;return {message:`Order ${cmd.to}.`};
  }
  if(cmd.kind==='league'){
    requireRule(actor.role==='super_admin'||actor.role==='league_organizer','FORBIDDEN','Organizer access is required.');text(cmd.name,'Competition name');requireRule(data.leagues.some(x=>x.sport_id===cmd.sportId),'VALIDATION_ERROR','Choose an available sport.');
    world.leagueOwners[id]=actor.userId;data.leagues.push({league_id:id,name:cmd.name.trim(),sport_id:cmd.sportId,tenant_id:actor.tenantId,format:cmd.format});return {id,message:'Mock competition created. Configure its season and stages next.'};
  }
  if(cmd.kind==='structure'){
    requireRule(organizer(actor,cmd.leagueId),'FORBIDDEN','Only the organizer of this competition can configure it.');text(cmd.name,'Name');
    if(cmd.category==='season')requireRule(cmd.startDate&&cmd.endDate&&validDate(cmd.startDate)&&validDate(cmd.endDate)&&cmd.endDate>=cmd.startDate,'VALIDATION_ERROR','Enter valid season start and end dates.');
    if(cmd.category==='division')requireRule(Number.isInteger(cmd.promotion)&&cmd.promotion!>=0&&Number.isInteger(cmd.relegation)&&cmd.relegation!>=0,'VALIDATION_ERROR','Promotion and relegation counts must be non-negative integers.');
    (world.configs[actor.tenantId] ||= []).push({id,leagueId:cmd.leagueId,category:cmd.category,name:cmd.name.trim(),detail:cmd.category==='season'?`${cmd.startDate} – ${cmd.endDate}`:cmd.category==='division'?`${cmd.promotion} promoted · ${cmd.relegation} relegated`:cmd.format||'league'});return {id,message:'Configuration saved to the mock workspace.'};
  }
  if(cmd.kind==='generate'){
    requireRule(organizer(actor,cmd.leagueId),'FORBIDDEN','Only the competition organizer can generate fixtures.');const league=data.leagues.find(x=>x.league_id===cmd.leagueId);requireRule(league,'LEAGUE_NOT_FOUND','Choose a competition.');requireRule(!data.fixtures.some(x=>x.league_id===cmd.leagueId),'LEAGUE_ALREADY_EXISTS','This competition already has fixtures. Existing matches are preserved.');
    const teams=[...new Set(cmd.teamIds)];requireRule(teams.length>=2&&teams.length<=32,'VALIDATION_ERROR','Choose between 2 and 32 teams.');const known=new Map(data.fixtures.flatMap(x=>[[x.home_team_id,x.home_name],[x.away_team_id,x.away_name]] as [string,string|undefined][]));requireRule(teams.every(x=>known.has(x)),'INVALID_TEAM','Choose teams from the current organization.');
    const pairs:string[][]=[];for(let i=0;i<teams.length;i++)for(let j=i+1;j<teams.length;j++)if(cmd.format==='round_robin'||j===i+1&&i%2===0)pairs.push([teams[i],teams[j]]);
    pairs.forEach(([home,away],index)=>data.fixtures.push({match_id:`${id}-${index+1}`,league_id:cmd.leagueId,home_team_id:home,away_team_id:away,home_name:known.get(home),away_name:known.get(away),status:'upcoming',scheduled_at:null,venue:null,score:{home:0,away:0},version:0,events:[],pinned_product:null}));projectStandings(data,cmd.leagueId);return {message:`${pairs.length} mock fixtures generated. Schedule them in match management.`};
  }
  if(cmd.kind==='status'||cmd.kind==='schedule'){
    const match=matchIn(data,cmd.matchId);assertManage(actor,match);
    if(cmd.kind==='status'){
      const transitions:Record<string,string[]>={upcoming:['postponed','cancelled'],in_progress:['abandoned'],postponed:['upcoming','cancelled']};requireRule(transitions[match.status]?.includes(cmd.status),'ILLEGAL_TRANSITION','This status transition is not allowed.');text(cmd.reason,'Reason');match.status=cmd.status;
      (world.configs[actor.tenantId] ||= []).push({id,leagueId:match.league_id,category:'match_status',name:match.match_id,detail:`${cmd.status}: ${cmd.reason}`});return {message:'Match status updated.'};
    }
    requireRule(['upcoming','postponed'].includes(match.status),'ILLEGAL_TRANSITION','Only upcoming or postponed matches can be rescheduled.');text(cmd.venue,'Venue');requireRule(Number.isFinite(Date.parse(cmd.date)),'VALIDATION_ERROR','Enter a valid date and time, including timezone.');
    const conflict=data.fixtures.find(x=>x.match_id!==match.match_id&&x.scheduled_at&&!['cancelled','abandoned'].includes(x.status)&&Math.abs(Date.parse(x.scheduled_at)-Date.parse(cmd.date))<120*60000&&(x.venue===cmd.venue||[x.home_team_id,x.away_team_id].some(team=>[match.home_team_id,match.away_team_id].includes(team))));
    requireRule(!conflict,'SCHEDULE_CONFLICT','This time conflicts with a venue booking, team match or two-hour rest window. Choose another time.');match.scheduled_at=new Date(cmd.date).toISOString().replace('.000Z','Z');match.venue=cmd.venue.trim();return {message:'Match schedule saved.'};
  }
  if(cmd.kind==='product'){
    requireRule(manager(actor,cmd.clubId)&&data.clubs.some(x=>x.club_id===cmd.clubId),'FORBIDDEN','Choose a club you manage.');text(cmd.name,'Product name');text(cmd.category,'Category');requireRule(Number.isSafeInteger(cmd.price)&&cmd.price>0&&Number.isSafeInteger(cmd.stock)&&cmd.stock>=0,'VALIDATION_ERROR','Use a positive integer paisa price and non-negative stock count.');
    const product=data.products.find(x=>x.product_id===cmd.productId);if(product){requireRule(manager(actor,product.club_id),'FORBIDDEN','You cannot edit another club’s products.');product.name=cmd.name.trim();product.category=cmd.category.trim();const existing=product.variants.find(x=>x.variant_id===cmd.variantId);if(cmd.variantId)requireRule(existing,'VARIANT_NOT_FOUND','This variant is unavailable.');if(existing){existing.size=cmd.size;existing.color=cmd.color;existing.price_minor=cmd.price;existing.stock=cmd.stock;}else product.variants.push({variant_id:id,size:cmd.size,color:cmd.color,price_minor:cmd.price,stock:cmd.stock});}
    else data.products.push({product_id:id,name:cmd.name.trim(),category:cmd.category.trim(),club_id:cmd.clubId,variants:[{variant_id:`${id}-variant`,size:cmd.size,color:cmd.color,price_minor:cmd.price,stock:cmd.stock}]});return {id:product?.product_id||id,message:product?'Product saved with a new variant.':'Product added to the catalogue.'};
  }
  if(cmd.kind==='price'){
    const product=data.products.find(x=>x.product_id===cmd.productId);requireRule(product&&manager(actor,product.club_id),'FORBIDDEN','Choose a product from your club.');const variant=product.variants.find(x=>x.variant_id===cmd.variantId);requireRule(variant,'VARIANT_NOT_FOUND','Choose a variant.');requireRule(Number.isSafeInteger(cmd.price)&&cmd.price>0&&validDate(cmd.effectiveDate),'VALIDATION_ERROR','Use a positive integer paisa price and a valid date.');
    (world.configs[actor.tenantId] ||= []).push({id,category:'price',name:product.name,detail:`${cmd.price} paisa from ${cmd.effectiveDate}`,effectiveDate:cmd.effectiveDate,price:cmd.price,productId:cmd.productId,variantId:cmd.variantId});if(cmd.effectiveDate<=now.slice(0,10))variant.price_minor=cmd.price;return {message:'Price schedule saved.'};
  }
  if(cmd.kind==='tenant'){
    requireRule(actor.role==='super_admin','FORBIDDEN','Only the platform admin can edit organization branding.');text(cmd.name,'Organization name');requireRule(/^#[0-9a-f]{6}$/i.test(cmd.primary)&&/^#[0-9a-f]{6}$/i.test(cmd.secondary),'VALIDATION_ERROR','Enter six-digit hex colors, such as #163D32.');data.tenant!.name=cmd.name.trim();data.tenant!.colors={primary:cmd.primary,secondary:cmd.secondary};for(const value of Object.values(world.datasets))value.tenants=Object.values(world.datasets).map(x=>x.tenant!);return {message:'Organization branding saved.'};
  }
  requireRule(actor.role==='super_admin','FORBIDDEN','Only the platform admin can configure scoring.');text(cmd.name,'Sport name');text(cmd.event,'Event name');requireRule(Number.isInteger(cmd.points)&&cmd.points>0&&cmd.points<=100,'VALIDATION_ERROR','Points must be an integer from 1 to 100.');requireRule(!data.eventTypes.some(x=>x.value===cmd.event.trim()),'VALIDATION_ERROR','This event already exists. Existing event values are preserved.');data.eventTypes.push({value:cmd.event.trim(),label:cmd.name.trim(),points:cmd.points});return {message:'Mock scoring event added.'};
}
function settleDeferred(world: MockWorld, now: string) {
  for(const item of [...world.deferred]){const data=world.datasets[item.tenantId];const player=playerIn(data,item.command.playerId).player;if(activeRosterMatch(data,player)||item.command.effectiveDate>now.slice(0,10))continue;applyRoster(world,data,item.actor,item.command,item.id,now,true);world.deferred=world.deferred.filter(x=>x.id!==item.id);(data.history[item.command.playerId] ||= []).push({audit_id:`${item.id}-effective`,action:'registration_effective',effective_date:now.slice(0,10),who:item.actor.userId,why:'Deferred registration is now effective.',state:'active'});}
}
// MOB-01…12: atomic local mock operation. Caller persists returned world before feedback.
export function execute(world: MockWorld, actor: Actor, command: Command, id: string, now: string, online=true): Result {
  try {
    requireRule(demoAccounts.some(x=>x.user_id===actor.userId&&x.role===actor.role),'UNAUTHENTICATED','Please sign in again.');
    requireRule(actor.role==='super_admin'||demoAccounts.find(x=>x.user_id===actor.userId)?.tenant_id===actor.tenantId,'FORBIDDEN','This organization is outside your account.');
    const principal=actorFor(actor.role,actor.tenantId);actor={...principal,leagueIds:[...principal.leagueIds,...Object.entries(world.leagueOwners).filter(([,owner])=>owner===principal.userId).map(([league])=>league)]};
    const next=clone(world);
    if(next.processed.includes(id))return {ok:true,world:next,id,message:'This action was already applied.'};
    if(!online){
      requireRule(command.kind==='score'||command.kind==='roster','SERVICE_UNAVAILABLE','This action needs a connection. Your entries are kept on this screen.');
      // Validate against a disposable copy without publishing a local score/roster change.
      apply(clone(next),actor,command,id,now);
      requireRule(!next.pending.some(x=>x.request.action_id===id),'DUPLICATE_REQUEST_ID','This action is already pending.');
      const data=next.datasets[actor.tenantId];const payload:Record<string,unknown>=command.kind==='score'?{event_id:id,match_id:command.matchId,type:command.eventType,payload:command.eventType==='score'?{team_id:command.teamId,event_type:command.scoringEvent}:command.eventType==='compensation'?{compensates:command.targetId,reason:command.reason}:{}}:{request_id:id,player_id:command.playerId,type:command.action,from_squad_id:playerIn(data,command.playerId).player.squad_id,to_squad_id:command.toSquadId||null,effective_date:command.effectiveDate,loan_end_date:command.loanEndDate||null,reason:command.reason,requested_by:actor.userId,league_id:data.squads?.find(x=>x.squad_id===playerIn(data,command.playerId).player.squad_id)?.league_id};
      next.pending.push({actor:clone(actor),command:clone(command),label:command.kind==='score'?`Match ${command.eventType.replace(/_/g,' ')}`:`Player ${command.action}`,request:{action_id:id,type:command.kind==='score'?'score_event':'roster_transfer',queued_at:now,base_version:command.kind==='score'?matchIn(data,command.matchId).version:0,payload}});
      return {ok:true,world:next,id,queued:true,message:'Saved on this device. Pending until you reconnect and sync.'};
    }
    const result=apply(next,actor,command,id,now);next.processed.push(id);next.datasets[actor.tenantId].lastUpdated=now;return {ok:true,world:next,...result};
  } catch(error){return {ok:false,code:error instanceof MockError?error.code:'INTERNAL_ERROR',message:error instanceof MockError?error.message:'We could not complete this action. Please retry.'};}
}
export function syncWorld(world: MockWorld, actor: Actor, now: string): MockWorld {
  let next=clone(world);const batch=next.pending.filter(x=>x.actor.userId===actor.userId&&x.actor.tenantId===actor.tenantId).slice(0,100);
  for(const item of batch){const duplicate=next.processed.includes(item.request.action_id);const result=execute(next,actor,item.command,item.request.action_id,now,true);if(result.ok)next=result.world;
    next.outcomes.unshift({action_id:item.request.action_id,label:item.label,queued_at:item.request.queued_at,status:!result.ok?'rejected':duplicate?'duplicate':'applied',reason:result.message,userId:actor.userId,tenantId:actor.tenantId});next.pending=next.pending.filter(x=>x.request.action_id!==item.request.action_id);}
  return next;
}
export function refreshWorld(world: MockWorld, now: string) {
  const next=clone(world);settleDeferred(next,now);
  for(const [tenantId,data] of Object.entries(next.datasets)){
    for(const entry of (next.configs[tenantId]||[]).filter(x=>x.category==='price'&&x.effectiveDate!<=now.slice(0,10)).sort((a,b)=>a.effectiveDate!.localeCompare(b.effectiveDate!))){const variant=data.products.find(x=>x.product_id===entry.productId)?.variants.find(x=>x.variant_id===entry.variantId);if(variant)variant.price_minor=entry.price!;}
    data.lastUpdated=now;
  }
  return next;
}
