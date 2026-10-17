import type { Role } from '../types/preview';
import type { StackParams, TabParams } from './routes';
type Entry = { id: string; title: string; screen: keyof StackParams; roles?: Role[] } | { id: string; title: string; tab: keyof TabParams; roles?: Role[] };
const managers:Role[]=['club_manager','super_admin'];
const organizers:Role[]=['league_organizer','super_admin'];
export const screenRegistry:Entry[] = [
  {id:'S01',title:'Login',screen:'Login'}, {id:'S02',title:'Settings',screen:'Settings'},
  {id:'S03',title:'Fixtures',tab:'Fixtures'}, {id:'S04',title:'Standings',tab:'Standings'},
  {id:'S05',title:'Match Detail',screen:'MatchDetail'}, {id:'S06',title:'Club Profile',tab:'Club'},
  {id:'S07',title:'Account',screen:'Account'}, {id:'S08',title:'Player Profile',screen:'PlayerProfile'},
  {id:'S09',title:'Store',tab:'Store'}, {id:'S10',title:'Product Detail',screen:'ProductDetail'},
  {id:'S11',title:'Cart',screen:'Cart'}, {id:'S12',title:'Checkout',screen:'Checkout'},
  {id:'S13',title:'Receipt',screen:'Receipt'}, {id:'S14',title:'Orders',screen:'Orders'},
  {id:'S15',title:'Order Detail',screen:'OrderDetail'}, {id:'S16',title:'Roster',tab:'Roster',roles:managers},
  {id:'S17',title:'Add Player',screen:'AddPlayer',roles:managers}, {id:'S18',title:'Roster Action',screen:'RosterAction',roles:managers},
  {id:'S19',title:'Scoring Entry',screen:'ScoringEntry',roles:organizers}, {id:'S20',title:'Compensation',screen:'Compensation',roles:organizers},
  {id:'S21',title:'Sync Status',screen:'SyncStatus'},
  {id:'S22',title:'Management',screen:'Management',roles:['super_admin','club_manager','league_organizer']},
  {id:'S23',title:'Create Competition',screen:'CompetitionSetup',roles:organizers},
  {id:'S24',title:'Competition Structure',screen:'CompetitionStructure',roles:organizers},
  {id:'S25',title:'Generate Fixtures',screen:'FixtureGeneration',roles:organizers},
  {id:'S26',title:'Match Management',screen:'MatchManagement',roles:organizers},
  {id:'S27',title:'Catalogue Management',screen:'CatalogueManagement',roles:managers},
  {id:'S28',title:'Price Schedule',screen:'PriceSchedule',roles:managers},
  {id:'S29',title:'Order Fulfillment',screen:'OrderManagement',roles:managers},
  {id:'S30',title:'Organization Branding',screen:'TenantManagement',roles:['super_admin']},
  {id:'S31',title:'Scoring Configuration',screen:'SportConfiguration',roles:['super_admin']},
];
export function canPreviewScreen(id:string,role:Role) { const item=screenRegistry.find(x=>x.id===id);return !!item&&(!item.roles||item.roles.includes(role)); }
export function tabsForRole(role:Role): (keyof TabParams)[] {
  return ['Fixtures','Standings','Store','Club',...(role==='club_manager'?['Roster']:role==='league_organizer'?['Scoring']:[])] as (keyof TabParams)[];
}
