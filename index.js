const yaml = require('yaml');
const { jptr } = require('reftools/lib/jptr');

var protobuf = require('protocol-buffers-schema')
var mappings = {
  'array': 'repeated',
  'object': 'message',
  'integer': 'int64',
  'number': 'float',
  'string': 'string',
  'boolean': 'bool'
}
var base;

var protoBufRoot = {
  syntax: 3,
  package: null,
  enums: [],
  messages: []
};

module.exports = function (schema) {
  protoBufRoot = {
    syntax: 3,
    package: null,
    enums: [],
    messages: []
  };
  if (typeof schema === 'string') schema = yaml.parse(schema)
  base = schema;
  result = protoBufRoot;

  if (schema.type === 'object') {
    result.messages.push(Message(schema))
  }
  return protobuf.stringify(result)
}

function Message (schema, parentProp) {

  if (schema.$ref) { // follow $refs
    schema = jptr(base,schema.$ref)
  }

  var message = {
    name: schema.name||parentProp||schema.title,
    enums: [],
    messages: [],
    fields: []
  }

  var tag = 1
  for (var key in schema.properties) {
    var field = schema.properties[key]
    if (field.$ref) { // follow $refs
      field = jptr(base,field.$ref)
    }
    field.name = key
    if (field.type === 'object') {
      field.type = field.name + 'Type';
      message.fields.push(Field(field, tag, message))
      field.name = field.type;
      message.messages.push(Message(field,key))
    } else {
      message.fields.push(Field(field, tag, message))
    }
    tag += 1
  }

  if (typeof schema.additionalProperties === 'object') {
    var field = schema.additionalProperties
    if (field.$ref) { // follow $refs
      field = jptr(base,field.$ref)
    }
    if (field.type === 'object') {
      field.name = 'additionalProperties';
      field.type = field.name + 'Type';
      message.fields.push(Field(field, tag, message))
      field.name = field.type;
      message.messages.push(Message(field,key))
    } else {
      message.fields.push(Field(field, tag, message))
    }
    tag += 1
  }

  for (var i in schema.required) {
    var required = schema.required[i]
    for (var i in message.fields) {
      var field = message.fields[i]
      if (required === field.name) field.required = true
    }
  }

  return message
}

function Field(field, tag, message) {
  var type = mappings[field.type] || field.type || 'bytes'
  var repeated = false

  if (field.type === 'array') {
    repeated = true
    if (field.items && field.items.type === 'object') {
      if (field.items.$ref) { // follow $refs
        field.items = jptr(base,field.items.$ref)
      }
      field.items.name = field.name;
      protoBufRoot.messages.push(Message(field.items,field.name))
      type = field.name
    } else {
      type = (field.items ? field.items.type : 'object');
    }    
  } else if (field.type === 'string' && field.enum){
    type = field.name + "Enum";
    message.enums.push(Enum(field))
  }

  //console.assert(typeof field.name !== 'undefined');
  return {
    name: field.name || 'field'+tag,
    type: type,
    tag: tag,
    repeated: repeated
  }
}

function Enum(field){
//  var options = {"option1" : 0, "option2" : 1};
   var protoEnum = {
    name: field.name + "Enum",
    options: [],
    values: []
  }

for (var e in field.enum) {
    var enumValue = {  value : e, options : []}
    var enumName = field.enum[e].replace(new RegExp('[.]', 'g'), '_')
    protoEnum.values[enumName] = enumValue;
  };
  return protoEnum;
}
