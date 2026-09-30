/* Shapes emitted by MLS-Bench scripts/gen_ml_relay_site.py. */

export interface Range { start: number; end: number; whole_file?: boolean }

export interface CodeFile {
  filename: string;
  editable: boolean;
  edit_ranges: Range[];
  read_ranges: Range[];
  content: string | null;
  lines: number;
  language: string;
  source: string | null;
  truncated: boolean;
}

export interface TermResult { name: string; metric: string; raw: number | null; score: number; params: Record<string, number | string | null> }
export interface SettingResult { name: string; score: number; objective: number; penalty: number; valid: boolean; invalid_reason: string | null; terms: TermResult[] }
export interface ArmScore { in_config: boolean; score: number; valid: boolean; row_seed: string; row_timestamp: string; settings: SettingResult[] }

export interface Diff { file: string; diff: string | null; changed: Range[]; new_content: string | null; added: number; removed: number; not_in_listing?: boolean }

export interface Baseline {
  slug: string; name: string | null; role: "oracle" | "anchor" | "declared null";
  is_null: boolean; is_oracle: boolean; no_op: boolean;
  ops_file: string | null; docstring: string | null; source?: string;
  ops: { op: string; file: string; start_line?: number; end_line?: number; after_line?: number }[];
  diffs: Diff[]; cmd?: string | null; env?: Record<string, string> | null;
  score: number | null; setting_scores: Record<string, number>;
  score_detail: ArmScore | null; what?: string | null; what_source?: string | null;
}

export interface Control { slug: string; name: string | null; score: number | null }

export interface TestCmd { label: string; cmd: string; group: number | null; compute: number | null; time: string | null; mem: string | null; package: string | null; script: string | null }

export interface Setting {
  name: string; display: string | null;
  labels: string[]; metrics: string[]; terms: [string, number][]; constraints: string[];
  cmds: TestCmd[]; auxiliary?: boolean;
}

export interface Term {
  name: string; metric: string; role: string; direction: "higher" | "lower"; transform: string; norm_type: string;
  bound: number | null; ref: { kind: string; metric?: string; value?: number } | null;
  ref_score: number | null; scale: number | null;
  constraint_target: number | null; constraint_sharpness: number; floor_raw: number | null; best_raw: number | null;
}

export interface Scoring {
  default_ref_score: number; terms: Term[];
  settings: { name: string; terms: [string, number][]; constraints: string[] }[];
  task_agg: string; anchor_baselines: string[]; arms: Record<string, ArmScore>;
  term_params: Record<string, Record<string, number | string | null>>; gmean_eps: number | null;
}

export interface LbRow { kind: "baseline" | "control" | "agent"; arm: string; seed: string; timestamp: string; is_final: boolean; n_raw_rows: number; values: Record<string, number | string | null> }
export interface LbSummary { kind: "baseline" | "control" | "agent"; arm: string; n_seeds: number; seeds: string[]; mean: Record<string, number>; std: Record<string, number>; mean_source: Record<string, string> }
export interface Leaderboard {
  columns: string[]; metric_columns: string[]; elapsed_columns: string[]; scored_columns: string[];
  reported_columns: string[]; rows: LbRow[]; summaries: LbSummary[];
}

export interface Curated { pipeline?: string; starter?: string }

export interface DescSection { title: string; level: number; kind: string; md: string }

export interface TaskData {
  id: string; n: number; title: string | null; area: string | null; question: string | null;
  repo: string | null; repo_url: string | null; elab: string | null;
  readme_settings_line: string | null; readme_methods_line: string | null;
  description_md: string; desc_sections: DescSection[]; instruction_harness: Record<string, string>; curated: Curated | null;
  files: CodeFile[]; starter_regions: { filename: string; start: number; end: number; whole_file: boolean; code: string }[];
  baselines: Baseline[]; controls: Control[]; oracle: string | null;
  settings: Setting[];
  exec: {
    seeds: (number | string)[] | null; seeds_note: string | null; gpus: number | null; cpus: number | null; memory_mb: number | null;
    storage_mb: number | null; allow_internet: boolean | null; agent_timeout_sec: number | null; verifier_timeout_sec: number | null;
    use_cuda: boolean; trusted_result: boolean | null; ephemeral_inputs: boolean | null; allow_create: boolean | null;
    rigorous_codebase: boolean | null; notes: Record<string, string>; resources_note: string | null; packages: string[];
    data_deps: { name: string; description: string }[];
  };
  scoring: Scoring | null; score_spec_source: string; leaderboard: Leaderboard;
  mode?: "internal";
}

export interface IndexEntry {
  id: string; n: number; title: string | null; area: string | null; question: string | null; repo: string | null;
  settings: { name: string; display: string | null }[];
  baselines: { slug: string; name: string | null; role: string }[];
  oracle?: string | null; oracle_name?: string | null; oracle_score?: number | null; best_score?: number | null;
  gpus?: number | null;
}

export interface IndexData { generated: string; source: string; mode?: "public" | "internal"; relay_ref_score: number; intro_md: string; tasks: IndexEntry[] }

export interface PublicFile { filename: string; editable: boolean; edit_ranges: Range[]; language: string; lines: number; content: string | null; omitted: string | null }
export interface PublicBaseline {
  slug: string; name: string | null; is_null: boolean; no_op: boolean; role: string;
  docstring: string | null; ops_file: string | null; source?: string | null; diffs: Diff[];
  score: number | null; setting_scores: Record<string, number>; score_detail: ArmScore | null;
}
export interface PublicTaskData {
  mode: "public";
  id: string; n: number; title: string | null; area: string | null; question: string | null;
  repo: string | null; repo_url: string | null; elab: string | null;
  readme_settings_line: string | null; readme_methods_line: string | null;
  description_md: string; desc_sections: DescSection[]; instruction_harness: Record<string, string>;
  files: PublicFile[]; baselines: PublicBaseline[]; controls: Control[];
  settings: Setting[]; scoring: Scoring | null; leaderboard: Leaderboard;
}

export interface Gap { task: string; field: string; detail: string }
export interface GapsData { generated: string; n_gaps: number; by_field: Record<string, number>; gaps: Gap[] }
