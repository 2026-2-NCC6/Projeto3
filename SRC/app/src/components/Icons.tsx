import React from 'react';
import Svg, { Circle, Path, Rect, Ellipse } from 'react-native-svg';

type IconProps = { size?: number; color?: string; strokeWidth?: number };

export function IconRacket({ size = 24, color = '#F5F5F7', strokeWidth = 1.5 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Ellipse cx={12} cy={9} rx={6.4} ry={7.4} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M8.4 3.6v10.8M12 2.2v13.6M15.6 3.6v10.8" stroke={color} strokeWidth={strokeWidth} opacity={0.55} />
      <Path d="M6.5 6.4h11M5.7 9.4h12.6M6.5 12.4h11" stroke={color} strokeWidth={strokeWidth} opacity={0.55} />
      <Path d="M12 16.4v5.4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function LogoMark({ size = 46, color = '#CBE81F', ringColor = '#38383A' }: { size?: number; color?: string; ringColor?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Circle cx={24} cy={24} r={14} stroke={ringColor} strokeWidth={2.4} />
      <Circle cx={24} cy={24} r={5.5} stroke={color} strokeWidth={2.4} />
      <Path d="M2 42C10 33 16 16 46 7" stroke={color} strokeWidth={2.4} strokeDasharray="0.5 6.5" opacity={0.75} strokeLinecap="round" />
    </Svg>
  );
}

export function IconInicio({ size = 23, color = '#6E6E73' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 11.4 12 4l8 7.4" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6 9.8V19a1 1 0 0 0 1 1h3.2v-5.2h3.6V20H17a1 1 0 0 0 1-1V9.8" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconTreinos({ size = 23, color = '#6E6E73' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7h11M4 12h11M4 17h7" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      <Circle cx={19} cy={17} r={2.4} stroke={color} strokeWidth={1.7} />
    </Svg>
  );
}

export function IconSessao({ size = 23, color = '#6E6E73' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8.4} stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M10.6 9.3v5.4l4.5-2.7z" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconHistorico({ size = 23, color = '#6E6E73' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 19v-8M9.3 19V6M14.7 19v-5M20 19V9" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

export function IconPerfil({ size = 23, color = '#6E6E73' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8.4} r={3.5} stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      <Path d="M5.5 19.6c0-3.3 2.9-5.6 6.5-5.6s6.5 2.3 6.5 5.6" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

export function IconBack({ size = 22, color = '#F5F5F7' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M14.5 5.5L8 12l6.5 6.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconChevronRight({ size = 14, color = '#48484A' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9.5 5.5L16 12l-6.5 6.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function IconCheckCircle({ size = 16, color = '#22C55E' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8.6} stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8.2 12.2l2.6 2.6 5-5.4" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconCheck({ size = 13, color = '#0B1A10' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12.5l4.6 4.5L19 6.5" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconAlert({ size = 34, color = '#EF4444' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8.6 3.4h6.8l4.8 4.8v6.8l-4.8 4.8H8.6l-4.8-4.8V8.2z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M9.6 9.6h4.8v4.8H9.6z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  );
}

export function IconPulse({ size = 20, color = '#CBE81F' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2 13h3l2-6 3 11 2-8 1.5 3H22" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconSignal({ size = 24, color = '#6E6E73', op1 = 1, op2 = 1, op3 = 1 }: IconProps & { op1?: number; op2?: number; op3?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 9.4a12 12 0 0 1 16 0" stroke={color} strokeWidth={1.7} strokeLinecap="round" opacity={op3} />
      <Path d="M7.3 13a7.4 7.4 0 0 1 9.4 0" stroke={color} strokeWidth={1.7} strokeLinecap="round" opacity={op2} />
      <Circle cx={12} cy={17.4} r={1.3} stroke={color} strokeWidth={1.7} opacity={op1} />
    </Svg>
  );
}

export function IconTrophy({ size = 24, color = '#22C55E' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7.5 4h9v4.4a4.5 4.5 0 0 1-9 0z" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M7.5 5.4H5.2A2.4 2.4 0 0 0 7.6 7.8M16.5 5.4h2.3a2.4 2.4 0 0 1-2.4 2.4" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 12.9v3.3M9.2 20h5.6l-.8-3.8h-4z" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconCalendar({ size = 24, color = '#98989D' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3.5} y={5.5} width={17} height={15} rx={2.5} stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3.5 10h17M8 3.5v4M16 3.5v4" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconLocked({ size = 24, color = '#6E6E73' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4.5} y={10.5} width={15} height={9.5} rx={2} stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconShield({ size = 20, color = '#98989D' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3.4 19 6v5.4c0 4.7-3 7.9-7 9-4-1.1-7-4.3-7-9V6z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M9 12.1l2.1 2.1 3.9-4.3" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
