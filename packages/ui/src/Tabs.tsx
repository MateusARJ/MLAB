import React from 'react';
import { colors, typography } from './tokens';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  style?: React.CSSProperties;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, style }) => {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        borderBottom: `1px solid ${colors.borderStrong}`,
        backgroundColor: 'transparent',
        gap: '4px',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px 14px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${isActive ? colors.accent : 'transparent'}`,
              color: isActive ? colors.accent : colors.textMuted,
              fontSize: '13px',
              fontWeight: isActive ? 600 : 500,
              fontFamily: typography.fontFamily,
              cursor: 'pointer',
              transition: 'all 0.15s ease-in-out',
              outline: 'none',
              marginBottom: '-1px',
              userSelect: 'none',
            }}
          >
            {tab.icon && <span style={{ display: 'flex' }}>{tab.icon}</span>}
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && tab.count > 0 && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: '10px',
                  backgroundColor: isActive ? colors.accent : colors.surfaceHover,
                  color: isActive ? colors.bgBase : colors.textSecondary,
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
