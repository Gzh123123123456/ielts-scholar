export type Task1VisualKind =
  | 'line'
  | 'bar'
  | 'table'
  | 'pie'
  | 'mixed'
  | 'process'
  | 'map';

export interface Task1DataPoint {
  label: string;
  value: number;
}

export interface Task1Series {
  name: string;
  values: Task1DataPoint[];
  color?: string;
}

export interface Task1LineVisualSpec {
  kind: 'line';
  title: string;
  unit?: string;
  yLabel?: string;
  series: Task1Series[];
}

export interface Task1BarSeries {
  name: string;
  values: number[];
  color?: string;
}

export interface Task1BarVisualSpec {
  kind: 'bar';
  title: string;
  unit?: string;
  categories: string[];
  series: Task1BarSeries[];
}

export interface Task1TableVisualSpec {
  kind: 'table';
  title: string;
  unit?: string;
  columns: string[];
  rows: {
    label: string;
    values: Array<string | number>;
  }[];
}

export interface Task1PieSlice {
  name: string;
  value: number;
  color?: string;
}

export interface Task1PieVisualSpec {
  kind: 'pie';
  title: string;
  unit?: string;
  charts: {
    label: string;
    slices: Task1PieSlice[];
  }[];
}

export type Task1MixedPart =
  | Task1LineVisualSpec
  | Task1BarVisualSpec
  | Task1TableVisualSpec
  | Task1PieVisualSpec;

export interface Task1MixedVisualSpec {
  kind: 'mixed';
  title: string;
  parts: Task1MixedPart[];
}

export interface Task1ProcessVisualSpec {
  kind: 'process';
  title: string;
  stages: string[];
  cyclical?: boolean;
}

export type Task1MapFeatureType =
  | 'building'
  | 'green'
  | 'road'
  | 'path'
  | 'parking'
  | 'water'
  | 'entrance';

export interface Task1MapFeature {
  label: string;
  type: Task1MapFeatureType;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Task1MapVisualSpec {
  kind: 'map';
  title: string;
  maps: {
    label: string;
    features: Task1MapFeature[];
  }[];
}

export type WritingTask1VisualSpec =
  | Task1LineVisualSpec
  | Task1BarVisualSpec
  | Task1TableVisualSpec
  | Task1PieVisualSpec
  | Task1MixedVisualSpec
  | Task1ProcessVisualSpec
  | Task1MapVisualSpec;
