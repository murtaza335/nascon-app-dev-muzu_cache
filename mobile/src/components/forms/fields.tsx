import { useState } from 'react';
import { Pressable,TextInput,TextInputProps,View } from 'react-native';
import { useApp } from '../../app/AppContext';
import { colors as c,space,type } from '../../theme/tokens';
import { Icon } from '../Icon';
import { Row,T,ui } from '../display/primitives';
import { Empty } from '../feedback/states';
import { Sheet } from '../layout/containers';
export function Field({ label, error, helper, ...props }: TextInputProps & {
  label: string;
  error?: string;
  helper?: string;
}) {
  const [focus, setFocus] = useState(false);
  return <View style={{ gap: space.sm }}>

    <T variant="label">

      {label}

    </T>

    <TextInput {...props} accessibilityLabel={label} placeholderTextColor={c.muted} selectionColor={c.accent} cursorColor={c.accent} onFocus={e => {
      setFocus(true);
      props.onFocus?.(e);
    }} onBlur={e => {
      setFocus(false);
      props.onBlur?.(e);
    }} style={[{ ...type.body, color: c.text, minHeight: 56, borderWidth: focus ? 2 : 1, borderColor: error ? c.error : focus ? c.accent : c.outline, borderRadius: 12, paddingHorizontal: space.lg, paddingVertical: 14, backgroundColor: c.surface, textAlignVertical: props.multiline ? 'top' : 'center' }, props.style]} />

    {!!(error || helper) && <T variant="caption" color={error ? c.error : c.secondary} accessibilityLiveRegion="polite">

      {error || helper}

    </T>}

  </View>;
}
export function Select({ label, value, options, onChange, placeholder = 'Choose an option' }: {
  label: string;
  value?: string;
  options: {
    value: string;
    label: string;
  }[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  return <View style={{ gap: space.sm }}>

    <T variant="label">

      {label}

    </T>

    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${options.find(x => x.value === value)?.label || placeholder}`} onPress={() => setOpen(true)} style={[ui.between, { minHeight: 56, padding: space.lg, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.outline }]}>

      <T style={ui.grow} color={value ? c.text : c.muted}>

        {options.find(x => x.value === value)?.label || placeholder}

      </T>

      <Icon name="down" size={20} />

    </Pressable>

    <Sheet title={label} open={open} onClose={() => setOpen(false)}>

      {options.length ? options.map(x => <Row key={x.value} title={x.label} trailing={x.value === value ? <Icon name="check" color={c.accent} /> : undefined} onPress={() => {
        onChange(x.value);
        setOpen(false);
      }} />) : <Empty title="No choices available" body="Choices will appear when this information is available." />}

    </Sheet>

  </View>;
}
export function LeaguePicker() {
  const p = useApp();
  return <Select label="Competition" value={p.selectedLeague?.league_id} options={p.data.leagues.map(x => ({ value: x.league_id, label: x.name }))} onChange={p.setLeagueId} placeholder="Choose a competition" />;
}
