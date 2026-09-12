import { getAdminClient, getEvidenceBucket } from '../client';
import { assertNoError } from '../supabase-utils';
import { id, nowIso } from '../../lib/ids';
import { sha256Hex, type SourceFamily } from '../../lib/ingestion/source-family';

export type StoredSource = { id:string; contentHash:string; objectKey:string; duplicate:boolean; sourceFamily:SourceFamily; lineageId:string };

const safeFileName = (value: string | undefined) => (value || 'source').split(/[\\/]/).pop()!.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 160) || 'source';

export async function preserveSource(input:{ programId:string; bytes:Uint8Array; sourceFamily:SourceFamily; sourceUrl?:string; fileName?:string; contentType?:string; importedBy:string; lineageKey?:string; parserVersion:string }):Promise<StoredSource>{
  const db=getAdminClient();
  const contentHash=await sha256Hex(input.bytes);
  const existingResult=await db.from('source_artifacts')
    .select('id,content_hash,object_key,lineage_id,source_family')
    .eq('program_id',input.programId).eq('content_hash',contentHash).maybeSingle();
  assertNoError(existingResult.error,'Read existing source artifact');
  const existing=existingResult.data as any;
  if (existing) return { id:existing.id,contentHash:existing.content_hash,objectKey:existing.object_key,lineageId:existing.lineage_id,sourceFamily:existing.source_family,duplicate:true };

  const lineageKey=input.lineageKey ?? `${input.sourceFamily}:${input.sourceUrl ? new URL(input.sourceUrl).hostname : 'upload'}`;
  const lineageResult=await db.from('source_lineages').select('id').eq('program_id',input.programId).eq('lineage_key',lineageKey).maybeSingle();
  assertNoError(lineageResult.error,'Read source lineage');
  let lineageId=(lineageResult.data as any)?.id as string|undefined;
  if(!lineageId){
    lineageId=id('lineage');
    const inserted=await db.from('source_lineages').insert({id:lineageId,program_id:input.programId,lineage_key:lineageKey,created_at:nowIso()});
    assertNoError(inserted.error,'Create source lineage');
  }

  const artifactId=id('source');
  const objectKey=`programs/${input.programId}/evidence/${contentHash}/${safeFileName(input.fileName)}`;
  const bucket=getEvidenceBucket();
  const uploaded=await db.storage.from(bucket).upload(objectKey,input.bytes,{contentType:input.contentType ?? 'application/octet-stream',upsert:false});
  assertNoError(uploaded.error,'Preserve source bytes');

  const artifact=await db.from('source_artifacts').insert({
    id:artifactId,program_id:input.programId,lineage_id:lineageId,source_family:input.sourceFamily,
    source_url:input.sourceUrl ?? null,original_filename:input.fileName ?? null,content_type:input.contentType ?? null,
    content_hash:contentHash,object_key:objectKey,parser_version:input.parserVersion,imported_at:nowIso(),imported_by_email:input.importedBy,
  });
  if(artifact.error){
    await db.storage.from(bucket).remove([objectKey]);
    assertNoError(artifact.error,'Create source artifact');
  }
  return {id:artifactId,contentHash,objectKey,duplicate:false,sourceFamily:input.sourceFamily,lineageId};
}
