'use strict';

const DesignPreset = require('../js/lib/design-preset');

describe('DesignPreset.resolveDesignClass', () => {
  test('resolves each known preset to its CSS class name', () => {
    expect(DesignPreset.resolveDesignClass('DEFAULT')).toBe(
      'sta-design-default',
    );
    expect(DesignPreset.resolveDesignClass('BLUE')).toBe('sta-design-blue');
    expect(DesignPreset.resolveDesignClass('GREEN')).toBe('sta-design-green');
    expect(DesignPreset.resolveDesignClass('ORANGE')).toBe('sta-design-orange');
  });

  test('falls back to the default class for an unknown preset', () => {
    expect(DesignPreset.resolveDesignClass('NOT_A_PRESET')).toBe(
      'sta-design-default',
    );
  });

  test('falls back to the default class when the preset is missing', () => {
    expect(DesignPreset.resolveDesignClass(undefined)).toBe(
      'sta-design-default',
    );
    expect(DesignPreset.resolveDesignClass('')).toBe('sta-design-default');
  });
});
