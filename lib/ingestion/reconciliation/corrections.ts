import type { RallyOverrideField } from './overrides.js';

const allowedFields=new Set<RallyOverrideField>(['terminal_event_type','terminal_player_source_key','pathway','attribution']);
const allowedReasons=new Set(['reviewed_film','official_stats','scorekeeper_correction','roster_player_correction','other']);
const terminalTypes=new Set(['kill','attack_error','service_ace','service_error','stuff_block','setting_error','ball_handling_error','blocking_error','penalty_point','unknown']);
const pathways=new Set(['first_ball_sideout','regular_sideout','transition_point','direct_serve_point','unknown_phase']);
const attributions=new Set(['earned','given','pressure_created','unknown']);

export function validateMatchCorrection(input:{canCorrectData:boolean;fieldName:string;value:unknown;reason?:string|null}){
  if(!input.canCorrectData)throw new Error('DATA_CORRECTION_FORBIDDEN');
  if(!allowedFields.has(input.fieldName as RallyOverrideField))throw new Error('CORRECTION_FIELD_NOT_ALLOWED');
  if(input.reason!=null&&!allowedReasons.has(input.reason))throw new Error('CORRECTION_REASON_NOT_ALLOWED');
  if(input.fieldName==='terminal_event_type'&&!terminalTypes.has(String(input.value)))throw new Error('CORRECTION_VALUE_NOT_ALLOWED');
  if(input.fieldName==='terminal_player_source_key'&&input.value!==null&&typeof input.value!=='string')throw new Error('CORRECTION_VALUE_NOT_ALLOWED');
  if(input.fieldName==='pathway'&&!pathways.has(String(input.value)))throw new Error('CORRECTION_VALUE_NOT_ALLOWED');
  if(input.fieldName==='attribution'&&!attributions.has(String(input.value)))throw new Error('CORRECTION_VALUE_NOT_ALLOWED');
  return {fieldName:input.fieldName as RallyOverrideField,value:input.value,reason:input.reason??null};
}

export function validateUndoCorrection(input:{canCorrectData:boolean;fieldName:string;reason?:string|null}){
  if(!input.canCorrectData)throw new Error('DATA_CORRECTION_FORBIDDEN');
  if(!allowedFields.has(input.fieldName as RallyOverrideField))throw new Error('CORRECTION_FIELD_NOT_ALLOWED');
  if(input.reason!=null&&!allowedReasons.has(input.reason))throw new Error('CORRECTION_REASON_NOT_ALLOWED');
  return {fieldName:input.fieldName as RallyOverrideField,reason:input.reason??null};
}
