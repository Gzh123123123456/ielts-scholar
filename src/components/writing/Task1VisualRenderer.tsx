import React from 'react';
import type {
  Task1BarVisualSpec,
  Task1LineVisualSpec,
  Task1MapFeature,
  Task1MapVisualSpec,
  Task1MixedPart,
  Task1PieSlice,
  Task1PieVisualSpec,
  Task1ProcessVisualSpec,
  Task1TableVisualSpec,
  WritingTask1VisualSpec,
} from '@/src/data/questions/task1VisualTypes';

const palette = ['#34495e', '#b45f4d', '#5b7f67', '#8a6f3d', '#5f6f8f', '#9a6a72'];

const formatValue = (value: number | string, unit?: string) => {
  if (typeof value === 'string') return value;
  if (unit === '$') return `$${value}`;
  return `${value}${unit || ''}`;
};

const roundedMax = (value: number) => {
  if (value <= 2) return Math.ceil(value * 2) / 2;
  if (value <= 10) return Math.ceil(value);
  return Math.ceil(value / 10) * 10;
};

const axisTicks = (max: number) => {
  const top = roundedMax(max);
  return [0, top * 0.25, top * 0.5, top * 0.75, top];
};

const Task1ChartShell: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="border border-paper-ink/15 bg-white px-6 py-5">
    <h4 className="text-base font-sans font-bold text-center mb-5">{title}</h4>
    {children}
  </div>
);

const Legend: React.FC<{ items: { name: string; color: string }[] }> = ({ items }) => (
  <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2">
    {items.map(item => (
      <span key={item.name} className="inline-flex items-center gap-2 text-xs font-sans text-paper-ink/70">
        <span className="h-2.5 w-4" style={{ backgroundColor: item.color }} />
        {item.name}
      </span>
    ))}
  </div>
);

const LineVisual: React.FC<{ spec: Task1LineVisualSpec; compact?: boolean }> = ({ spec, compact = false }) => {
  const allValues = spec.series.flatMap(series => series.values.map(point => point.value));
  const maxValue = Math.max(...allValues, 1);
  const ticks = axisTicks(maxValue);
  const yMax = ticks[ticks.length - 1] || maxValue;
  const labels = spec.series[0]?.values.map(point => point.label) || [];
  const width = 640;
  const height = compact ? 260 : 320;
  const margin = { top: 18, right: 24, bottom: 46, left: 58 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const xFor = (index: number) => margin.left + (labels.length <= 1 ? plotWidth / 2 : (plotWidth / (labels.length - 1)) * index);
  const yFor = (value: number) => margin.top + plotHeight - (value / yMax) * plotHeight;

  return (
    <Task1ChartShell title={spec.title}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={spec.title} className="w-full">
        {ticks.map(tick => {
          const y = yFor(tick);
          return (
            <g key={tick}>
              <line x1={margin.left} y1={y} x2={width - margin.right} y2={y} stroke="#d7d0c8" strokeWidth="1" />
              <text x={margin.left - 10} y={y + 4} textAnchor="end" className="fill-paper-ink/55 text-[11px] font-sans">
                {formatValue(Number(tick.toFixed(2)), spec.unit)}
              </text>
            </g>
          );
        })}
        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={height - margin.bottom} stroke="#61584f" />
        <line x1={margin.left} y1={height - margin.bottom} x2={width - margin.right} y2={height - margin.bottom} stroke="#61584f" />
        {labels.map((label, index) => (
          <text key={label} x={xFor(index)} y={height - margin.bottom + 24} textAnchor="middle" className="fill-paper-ink/70 text-[12px] font-sans">
            {label}
          </text>
        ))}
        {spec.series.map((series, seriesIndex) => {
          const color = series.color || palette[seriesIndex % palette.length];
          const path = series.values
            .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index)} ${yFor(point.value)}`)
            .join(' ');
          return (
            <g key={series.name}>
              <path d={path} fill="none" stroke={color} strokeWidth="3" />
              {series.values.map((point, index) => (
                <circle key={`${series.name}-${point.label}`} cx={xFor(index)} cy={yFor(point.value)} r="4" fill={color} />
              ))}
            </g>
          );
        })}
      </svg>
      <Legend items={spec.series.map((series, index) => ({ name: series.name, color: series.color || palette[index % palette.length] }))} />
    </Task1ChartShell>
  );
};

const BarVisual: React.FC<{ spec: Task1BarVisualSpec; compact?: boolean }> = ({ spec, compact = false }) => {
  const maxValue = Math.max(...spec.series.flatMap(series => series.values), 1);
  const ticks = axisTicks(maxValue);
  const yMax = ticks[ticks.length - 1] || maxValue;
  const width = 640;
  const height = compact ? 260 : 320;
  const margin = { top: 18, right: 24, bottom: 56, left: 58 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const groupWidth = plotWidth / Math.max(spec.categories.length, 1);
  const barWidth = Math.min(34, (groupWidth * 0.72) / Math.max(spec.series.length, 1));
  const yFor = (value: number) => margin.top + plotHeight - (value / yMax) * plotHeight;

  return (
    <Task1ChartShell title={spec.title}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={spec.title} className="w-full">
        {ticks.map(tick => {
          const y = yFor(tick);
          return (
            <g key={tick}>
              <line x1={margin.left} y1={y} x2={width - margin.right} y2={y} stroke="#d7d0c8" strokeWidth="1" />
              <text x={margin.left - 10} y={y + 4} textAnchor="end" className="fill-paper-ink/55 text-[11px] font-sans">
                {formatValue(Number(tick.toFixed(2)), spec.unit)}
              </text>
            </g>
          );
        })}
        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={height - margin.bottom} stroke="#61584f" />
        <line x1={margin.left} y1={height - margin.bottom} x2={width - margin.right} y2={height - margin.bottom} stroke="#61584f" />
        {spec.categories.map((category, categoryIndex) => {
          const groupX = margin.left + categoryIndex * groupWidth + groupWidth / 2;
          return (
            <g key={category}>
              {spec.series.map((series, seriesIndex) => {
                const value = series.values[categoryIndex] || 0;
                const color = series.color || palette[seriesIndex % palette.length];
                const x = groupX - (barWidth * spec.series.length) / 2 + seriesIndex * barWidth;
                const y = yFor(value);
                return (
                  <rect
                    key={`${category}-${series.name}`}
                    x={x}
                    y={y}
                    width={barWidth * 0.82}
                    height={height - margin.bottom - y}
                    fill={color}
                  />
                );
              })}
              <text x={groupX} y={height - margin.bottom + 24} textAnchor="middle" className="fill-paper-ink/70 text-[12px] font-sans">
                {category}
              </text>
            </g>
          );
        })}
      </svg>
      <Legend items={spec.series.map((series, index) => ({ name: series.name, color: series.color || palette[index % palette.length] }))} />
    </Task1ChartShell>
  );
};

const TableVisual: React.FC<{ spec: Task1TableVisualSpec }> = ({ spec }) => (
  <Task1ChartShell title={spec.title}>
    {spec.unit && (
      <p className="mb-2 text-center text-xs font-sans text-paper-ink/55">Unit: {spec.unit}</p>
    )}
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-paper-ink/20 bg-paper-ink/[0.04] px-3 py-2 text-left font-sans">Area</th>
            {spec.columns.map(column => (
            <th key={column} className="border border-paper-ink/20 bg-paper-ink/[0.04] px-4 py-3 text-center font-sans">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spec.rows.map(row => (
            <tr key={row.label}>
            <th className="border border-paper-ink/20 px-4 py-3 text-left font-sans font-semibold">{row.label}</th>
              {row.values.map((value, index) => (
                <td key={`${row.label}-${index}`} className="border border-paper-ink/20 px-4 py-3 text-center">
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Task1ChartShell>
);

const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(radians),
    y: cy + r * Math.sin(radians),
  };
};

const describeSlice = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
};

const PieChart: React.FC<{ label: string; slices: Task1PieSlice[]; unit?: string; indexOffset?: number }> = ({
  label,
  slices,
  unit,
  indexOffset = 0,
}) => {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0) || 1;
  let currentAngle = 0;

  return (
    <div className="min-w-[220px] flex-1">
      <svg viewBox="0 0 220 190" role="img" aria-label={label} className="mx-auto w-full max-w-[260px]">
        {slices.map((slice, index) => {
          const startAngle = currentAngle;
          const endAngle = currentAngle + (slice.value / total) * 360;
          currentAngle = endAngle;
          const color = slice.color || palette[(index + indexOffset) % palette.length];
          const mid = polarToCartesian(110, 86, 54, (startAngle + endAngle) / 2);
          return (
            <g key={slice.name}>
              <path d={describeSlice(110, 86, 70, startAngle, endAngle)} fill={color} stroke="#fff" strokeWidth="2" />
              {slice.value >= total * 0.09 && (
                <text x={mid.x} y={mid.y + 4} textAnchor="middle" className="fill-white text-[11px] font-sans font-bold">
                  {formatValue(slice.value, unit)}
                </text>
              )}
            </g>
          );
        })}
        <text x="110" y="178" textAnchor="middle" className="fill-paper-ink/80 text-[13px] font-sans font-bold">
          {label}
        </text>
      </svg>
    </div>
  );
};

const PieVisual: React.FC<{ spec: Task1PieVisualSpec }> = ({ spec }) => (
  <Task1ChartShell title={spec.title}>
    <div className="flex flex-wrap justify-center gap-4">
      {spec.charts.map((chart, index) => (
        <PieChart key={chart.label} label={chart.label} slices={chart.slices} unit={spec.unit} indexOffset={index} />
      ))}
    </div>
    <Legend
      items={(spec.charts[0]?.slices || []).map((slice, index) => ({
        name: slice.name,
        color: slice.color || palette[index % palette.length],
      }))}
    />
  </Task1ChartShell>
);

const ProcessVisual: React.FC<{ spec: Task1ProcessVisualSpec }> = ({ spec }) => (
  <Task1ChartShell title={spec.title}>
    <div className="grid gap-3 md:grid-cols-3">
      {spec.stages.map((stage, index) => (
        <div key={stage} className="relative border border-paper-ink/20 bg-paper-ink/[0.02] px-5 py-5 min-h-[112px]">
          <div className="mb-2 text-xs font-sans font-bold uppercase text-paper-ink/45">Stage {index + 1}</div>
          <p className="text-base leading-7 text-paper-ink/80">{stage}</p>
          {index < spec.stages.length - 1 && (
            <span className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-xl text-paper-ink/45 md:block">-&gt;</span>
          )}
        </div>
      ))}
    </div>
    {spec.cyclical && (
      <p className="mt-4 text-center text-sm font-sans text-paper-ink/60">The final stage returns the product to shops, making the process cyclical.</p>
    )}
  </Task1ChartShell>
);

const mapFeatureClass = (feature: Task1MapFeature) => {
  if (feature.type === 'green') return 'border-[#7e946f] bg-[#dfe8d7] text-[#405239]';
  if (feature.type === 'parking') return 'border-[#8b8b8b] bg-[#eeeeee] text-[#555]';
  if (feature.type === 'road') return 'border-[#b8aca1] bg-[#d8d0c7] text-[#5e554e]';
  if (feature.type === 'path') return 'border-[#8a6f3d] bg-transparent text-[#6c552d] border-dashed';
  if (feature.type === 'water') return 'border-[#7b9daf] bg-[#dbeaf0] text-[#42606d]';
  if (feature.type === 'entrance') return 'border-[#b45f4d] bg-[#f4dfd8] text-[#8a402f]';
  return 'border-[#72695f] bg-[#eee8df] text-[#4b443d]';
};

const MapVisual: React.FC<{ spec: Task1MapVisualSpec }> = ({ spec }) => (
  <Task1ChartShell title={spec.title}>
    <div className="grid gap-4 md:grid-cols-2">
      {spec.maps.map(map => (
        <div key={map.label}>
          <p className="mb-2 text-center text-xs font-sans font-bold uppercase text-paper-ink/55">{map.label}</p>
          <div className="relative aspect-[4/3] min-h-[260px] border border-paper-ink/25 bg-[#faf8f2]">
            {map.features.map(feature => (
              <div
                key={`${map.label}-${feature.label}`}
                className={`absolute flex items-center justify-center overflow-hidden border px-1.5 text-center text-[11px] font-sans leading-tight ${mapFeatureClass(feature)}`}
                style={{
                  left: `${feature.x}%`,
                  top: `${feature.y}%`,
                  width: `${feature.width}%`,
                  height: `${feature.height}%`,
                }}
              >
                {feature.label}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </Task1ChartShell>
);

const MixedPartVisual: React.FC<{ part: Task1MixedPart }> = ({ part }) => {
  if (part.kind === 'line') return <LineVisual spec={part} compact />;
  if (part.kind === 'bar') return <BarVisual spec={part} compact />;
  if (part.kind === 'table') return <TableVisual spec={part} />;
  return <PieVisual spec={part} />;
};

export const Task1VisualRenderer: React.FC<{ spec?: WritingTask1VisualSpec; fallbackData?: string[] }> = ({
  spec,
  fallbackData = [],
}) => {
  if (!spec) {
    return (
      <div className="space-y-3">
        {fallbackData.map((item, index) => (
          <div key={`${item}-${index}`} className="border border-paper-ink/10 bg-paper-ink/[0.02] px-4 py-3">
            <p className="text-sm leading-7 text-paper-ink/75">{item}</p>
          </div>
        ))}
      </div>
    );
  }

  if (spec.kind === 'line') return <LineVisual spec={spec} />;
  if (spec.kind === 'bar') return <BarVisual spec={spec} />;
  if (spec.kind === 'table') return <TableVisual spec={spec} />;
  if (spec.kind === 'pie') return <PieVisual spec={spec} />;
  if (spec.kind === 'process') return <ProcessVisual spec={spec} />;
  if (spec.kind === 'map') return <MapVisual spec={spec} />;

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-sans font-bold text-center">{spec.title}</h4>
      <div className="grid gap-4 lg:grid-cols-2">
        {spec.parts.map((part, index) => (
          <MixedPartVisual key={`${part.kind}-${part.title}-${index}`} part={part} />
        ))}
      </div>
    </div>
  );
};
