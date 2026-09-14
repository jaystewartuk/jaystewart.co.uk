import metrics from '../data/metrics.json';

/**
 * Resolve figures quoted in content against src/data/metrics.json.
 *
 * Content references a figure by path — `spiralclass.apiRoutes` — rather than
 * writing the number. If the figure is renamed or removed, the build fails
 * here instead of the site rendering `undefined` to a reader.
 */

type Counts = Record<string, Record<string, number>>;

const projects = metrics.projects as Counts;

export const countedAt = metrics.countedAt;

export function count(path: string): number {
  const [project, key] = path.split('.');

  if (!project || !key) {
    throw new Error(`Metric path must be "project.key", got "${path}"`);
  }

  const values = projects[project];
  if (!values) {
    throw new Error(
      `No metrics for project "${project}". Known: ${Object.keys(projects).join(', ')}. ` +
        `Add it to src/data/metrics.json.`,
    );
  }

  const value = values[key];
  if (typeof value !== 'number') {
    throw new Error(
      `No metric "${key}" for "${project}". Known: ${Object.keys(values).join(', ')}.`,
    );
  }

  return value;
}

/** Thousands separators, so 1881 reads as 1,881. */
export function format(value: number | string): string {
  return typeof value === 'number' ? value.toLocaleString('en-GB') : value;
}

/** Resolve a content-declared metric to a display value. */
export function resolve(metric: { label: string; from?: string; value?: string | number }): {
  label: string;
  value: string;
} {
  if (metric.from !== undefined) {
    return { label: metric.label, value: format(count(metric.from)) };
  }

  if (metric.value !== undefined) {
    return { label: metric.label, value: format(metric.value) };
  }

  throw new Error(`Metric "${metric.label}" declares neither \`from\` nor \`value\`.`);
}
