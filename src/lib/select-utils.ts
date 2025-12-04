"use client";

import React from "react";

/**
 * Utility functions for handling select component values consistently
 * This helps prevent empty string value issues with Radix UI Select components
 */

export const SELECT_EMPTY_VALUES = {
  NONE: 'none',
  ALL: 'all',
  EMPTY: 'empty',
  NULL: 'null',
} as const;

type SelectEmptyValue = typeof SELECT_EMPTY_VALUES[keyof typeof SELECT_EMPTY_VALUES];

/**
 * Converts potentially empty/null values to safe select values
 */
export function toSafeSelectValue(value: string | null | undefined, emptyPlaceholder: SelectEmptyValue = SELECT_EMPTY_VALUES.NONE): string {
  if (value === null || value === undefined || value === '') {
    return emptyPlaceholder;
  }
  return value;
}

/**
 * Converts safe select values back to their original form (empty string for placeholders)
 */
export function fromSafeSelectValue(value: string, emptyPlaceholder: SelectEmptyValue = SELECT_EMPTY_VALUES.NONE): string {
  if (value === emptyPlaceholder) {
    return '';
  }
  return value;
}

/**
 * Handles the change event for select components that use safe values
 */
export function handleSelectChange(
  value: string,
  onChange: (value: string) => void,
  emptyPlaceholder: SelectEmptyValue = SELECT_EMPTY_VALUES.NONE
) {
  const processedValue = fromSafeSelectValue(value, emptyPlaceholder);
  onChange(processedValue);
}

/**
 * Common select value options for different use cases
 */
export const COMMON_SELECT_OPTIONS = {
  // For optional fields where no selection is valid
  optional: {
    emptyValue: SELECT_EMPTY_VALUES.NONE,
    emptyLabel: 'None',
    getProps: (label: string = 'None') => ({
      emptyValue: SELECT_EMPTY_VALUES.NONE,
      emptyLabel: label,
      toSafe: (value: string | null | undefined) => toSafeSelectValue(value, SELECT_EMPTY_VALUES.NONE),
      fromSafe: (value: string) => fromSafeSelectValue(value, SELECT_EMPTY_VALUES.NONE),
    })
  },

  // For filters where "all" is a valid option
  filter: {
    emptyValue: SELECT_EMPTY_VALUES.ALL,
    emptyLabel: 'All',
    getProps: (label: string = 'All') => ({
      emptyValue: SELECT_EMPTY_VALUES.ALL,
      emptyLabel: label,
      toSafe: (value: string | null | undefined) => toSafeSelectValue(value, SELECT_EMPTY_VALUES.ALL),
      fromSafe: (value: string) => fromSafeSelectValue(value, SELECT_EMPTY_VALUES.ALL),
    })
  },

  // For boolean selections
  boolean: {
    emptyValue: SELECT_EMPTY_VALUES.ALL,
    emptyLabel: 'All',
    getProps: (label: string = 'All') => ({
      emptyValue: SELECT_EMPTY_VALUES.ALL,
      emptyLabel: label,
      toSafe: (value: boolean | null | undefined) => {
        if (value === null || value === undefined) return SELECT_EMPTY_VALUES.ALL;
        return value.toString();
      },
      fromSafe: (value: string) => {
        if (value === SELECT_EMPTY_VALUES.ALL) return undefined;
        return value === 'true';
      },
    })
  }
} as const;

/**
 * React hook for managing select state with safe values
 */
export function useSafeSelectValue(
  initialValue: string | null | undefined,
  emptyPlaceholder: SelectEmptyValue = SELECT_EMPTY_VALUES.NONE
) {
  const [value, setValue] = React.useState(() => toSafeSelectValue(initialValue, emptyPlaceholder));

  const handleChange = React.useCallback((newValue: string) => {
    setValue(newValue);
  }, []);

  const getValue = React.useCallback(() => {
    return fromSafeSelectValue(value, emptyPlaceholder);
  }, [value, emptyPlaceholder]);

  const reset = React.useCallback(() => {
    setValue(emptyPlaceholder);
  }, [emptyPlaceholder]);

  return {
    value,
    setValue: handleChange,
    getValue,
    reset,
    isEmpty: value === emptyPlaceholder,
  };
}