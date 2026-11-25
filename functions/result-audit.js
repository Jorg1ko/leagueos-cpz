// Historial de resultados: las acciones se registran en el mismo batch D1
// que la modificación de la fila. Nunca elimina información ni usa SQL externo.
const TABLES={
  individual:{table:'cpz_match_results',key:'match_key',
    fields:['id','match_key','played_at','round_label','group_label','player_one_id','player_two_id','sets_json','winner_id','source_file','imported_at','deleted_at']},
  doubles:{table:'cpz_doubles_results',key:'id',
    fields:['id','group_label','pair_one','pair_two','played_at','round_label','sets_json','winner_pair','updated_at','deleted_at']}
};
export function resultTable(kind){
  const config=TABLES[kind];
  if(!config)throw Error('Modalidad no soportada');
  return config.table;
}
export async function previousResult(db,kind,key,value){
  const config=TABLES[kind];
  if(!config||!['id',config.key].includes(key))throw Error('Consulta de auditoría inválida');
  return db.prepare('SELECT * FROM '+config.table+' WHERE '+key+'=?').bind(value).first();
}
export function auditAfter(db,kind,action,previous,lookup,value,filter=''){
  const config=TABLES[kind];
  if(!config||!['create','edit','delete','restore'].includes(action)||!['id',config.key].includes(lookup))
    throw Error('Acción de auditoría inválida');
  if(!['',' AND deleted_at IS NULL',' AND deleted_at IS NOT NULL'].includes(filter))
    throw Error('Condición de auditoría no permitida');
  const rowJSON="json_object("+config.fields.map(field=>"'"+field+"',"+field).join(',')+")";
  const sql='INSERT INTO cpz_result_audit(competition,action,result_id,before_json,after_json) '
    +'SELECT ?,?,id,?,'+rowJSON+' FROM '+config.table+' WHERE '+lookup+'=?'+filter;
  return db.prepare(sql).bind(kind,action,previous?JSON.stringify(previous):null,value);
}
