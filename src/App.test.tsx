import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from './App.tsx';
import { TakeoffSheet } from './ui/TakeoffSheet.tsx';
import { STANDARD_MODEL } from './engine/standardModel.ts';

describe('default Designer workflow', () => {
  it('shows drawings and concise completion actions without the engineering dump', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Takeoff (.xlsx)');
    expect(html).toContain('Finish estimate');
    expect(html).not.toContain('Run full takeoff');
    expect(html).not.toContain('Soil profile');
    expect(html).not.toContain('Download JSON fallback');
    expect(html).not.toContain('Calculation Reference');
    expect(html).toContain('BCY bank');
    expect(html).toContain('LCY haul');
    expect(html).toContain('estimated loads');
  });

  it('keeps the full calculation body out of design rendering', () => {
    const html = renderToStaticMarkup(<TakeoffSheet job={STANDARD_MODEL} view="design" />);
    expect(html).toContain('sectionview');
    expect(html).not.toContain('id="out-materials"');
    expect(html).not.toContain('Assumptions carried on this sheet');
  });
});
