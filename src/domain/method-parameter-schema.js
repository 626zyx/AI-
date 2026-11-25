/* Pure parameter schema shared by defaults, composition and task validation. */
const choices = {
  cipher_type:['caesar','atbash','morse','ascii'],
  prompt_type:['python_stack','python_stack_plus','python_list','python_list_plus','python_string','python_string_plus'],
  jailbreak_template:['aim','dev_mode','evil_confidant'],
  technique:['prefix_injection','prefix_injection_hello','refusal_suppression','refusal_suppression_inv','base64','base64_input_only','base64_output_only','base64_raw','style_injection_short','style_injection_json','disemvowel','leetspeak','rot13','distractors','distractors_negated','wikipedia','wikipedia_with_title','poems','auto_payload_splitting','auto_obfuscation','combination_1','combination_2','combination_3','AIM','dev_mode_v2','dev_mode_with_rant','evil_confidant'],
};
export function parameterSchemaForMethod(method){
  if(!method)throw Error('攻击方法不存在');
  return (method.params||[]).map(param=>{
    const schema={...param,type:typeof param.value};
    if(choices[param.key])schema.options=[...choices[param.key]];
    if(schema.type==='number'){
      schema.integer=Number.isInteger(param.value);
      schema.min=['warm_up_iterations','lifelong_iterations','max_backtracks'].includes(param.key)?0:schema.integer?1:0;
      if(param.key==='intent_preservation_threshold')schema.max=5;
      if(param.key==='sub_threshold')schema.max=1;
      if(param.key.includes('temperature')){schema.max=2;schema.integer=false;}
    }
    return schema;
  });
}
