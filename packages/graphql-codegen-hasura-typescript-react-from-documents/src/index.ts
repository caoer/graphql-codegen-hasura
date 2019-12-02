import { PluginFunction, Types } from "@graphql-codegen/plugin-helpers";
import { RawTypesConfig } from "@graphql-codegen/visitor-plugin-common";
import { FragmentDefinitionNode, GraphQLSchema } from "graphql";
import { TypeMap } from "graphql/type/schema";
import { getPrimaryKeyIdField, injectDeleteReact, injectFetchReact, injectInsertReact, injectSharedReact, injectUpdateReact } from "../../shared";

// -----------------------------------------------------
//
// -----------------------------------------------------

export interface CstmHasuraCrudPluginConfig extends RawTypesConfig {
  reactApolloVersion?: number;
  typescriptCodegenOutputPath: string;
  trimString?: string;
  withQueries?: boolean;
  withInserts?: boolean;
  withUpdates?: boolean;
  withDeletes?: boolean;
}

export const plugin: PluginFunction<CstmHasuraCrudPluginConfig> = (schema: GraphQLSchema, documents: Types.DocumentFile[], config: CstmHasuraCrudPluginConfig) => {
  // Set config defaults
  if (!config.reactApolloVersion) config.reactApolloVersion = 3;

  const importArray: string[] = [
    `import { QueryHookOptions, useQuery, LazyQueryHookOptions, useLazyQuery, MutationHookOptions, useMutation } from '${
      config.reactApolloVersion === 3 ? "@apollo/client" : "@apollo/react-hooks"
    }'`,
    `import { FetchResult } from '${config.reactApolloVersion === 3 ? "@apollo/client" : "apollo-link"}'`,
    `import { ApolloClient } from '${config.reactApolloVersion === 3 ? "@apollo/client" : "apollo-client"}'`
  ];

  const contentArray: string[] = [];

  // get typemap from schema
  const typeMap = schema.getTypeMap();

  // iterate and generate
  documents
    .map(document => {
      document.content.definitions
        .filter(definition => definition.kind === "FragmentDefinition")
        .map(definition => {
          const fd = definition as FragmentDefinitionNode;
          return `
      ${makeEntitySharedTypeScript(fd, typeMap, importArray, contentArray, config)}
      ${config.withQueries && makeEntityQueryMutationTypeScript(fd, typeMap, importArray, contentArray, config)}
      ${config.withInserts && makeEntityInsertMutationTypeScript(fd, typeMap, importArray, contentArray, config)}
      ${config.withUpdates && makeEntityUpdateMutationTypeScript(fd, typeMap, importArray, contentArray, config)}
      ${config.withDeletes && makeEntityDeleteMutationTypeScript(fd, typeMap, importArray, contentArray, config)}
      `;
        });
    })
    .flat();

  return {
    prepend: importArray,
    content: contentArray.join("\n")
  };
};

// --------------------------------------
//

function makeEntitySharedTypeScript(
  fragmentDefinitionNode: FragmentDefinitionNode,
  schemaTypeMap: TypeMap,
  importArray: string[],
  contentArray: string[],
  config: CstmHasuraCrudPluginConfig
) {
  const fragmentName = fragmentDefinitionNode.name.value;
  const fragmentTableName = fragmentDefinitionNode.typeCondition.name.value;
  const relatedTableNamedType = schemaTypeMap[fragmentTableName];

  const relatedTablePrimaryKeyIdField = getPrimaryKeyIdField(relatedTableNamedType);
  if (!relatedTablePrimaryKeyIdField) return;

  injectSharedReact({
    contentArray,
    importArray,
    entityName: relatedTableNamedType.name,
    fragmentName,
    trimString: config.trimString,
    primaryKeyIdField: relatedTablePrimaryKeyIdField,
    typescriptCodegenOutputPath: config.typescriptCodegenOutputPath
  });
}
// --------------------------------------
//

function makeEntityQueryMutationTypeScript(
  fragmentDefinitionNode: FragmentDefinitionNode,
  schemaTypeMap: TypeMap,
  importArray: string[],
  contentArray: string[],
  config: CstmHasuraCrudPluginConfig
) {
  const fragmentName = fragmentDefinitionNode.name.value;
  const fragmentTableName = fragmentDefinitionNode.typeCondition.name.value;
  const relatedTableNamedType = schemaTypeMap[fragmentTableName];

  const relatedTablePrimaryKeyIdField = getPrimaryKeyIdField(relatedTableNamedType);
  if (!relatedTablePrimaryKeyIdField) return;

  injectFetchReact({
    contentArray,
    importArray,
    entityName: relatedTableNamedType.name,
    fragmentName,
    trimString: config.trimString,
    primaryKeyIdField: relatedTablePrimaryKeyIdField,
    typescriptCodegenOutputPath: config.typescriptCodegenOutputPath
  });
}

// --------------------------------------
//

function makeEntityInsertMutationTypeScript(
  fragmentDefinitionNode: FragmentDefinitionNode,
  schemaTypeMap: TypeMap,
  importArray: string[],
  contentArray: string[],
  config: CstmHasuraCrudPluginConfig
) {
  const fragmentName = fragmentDefinitionNode.name.value;
  const fragmentTableName = fragmentDefinitionNode.typeCondition.name.value;
  const relatedTableNamedType = schemaTypeMap[fragmentTableName];

  const relatedTablePrimaryKeyIdField = getPrimaryKeyIdField(relatedTableNamedType);
  if (!relatedTablePrimaryKeyIdField) return;

  injectInsertReact({
    contentArray,
    importArray,
    entityName: relatedTableNamedType.name,
    fragmentName,
    trimString: config.trimString,
    primaryKeyIdField: relatedTablePrimaryKeyIdField,
    typescriptCodegenOutputPath: config.typescriptCodegenOutputPath
  });
}
// --------------------------------------
//

function makeEntityUpdateMutationTypeScript(
  fragmentDefinitionNode: FragmentDefinitionNode,
  schemaTypeMap: TypeMap,
  importArray: string[],
  contentArray: string[],
  config: CstmHasuraCrudPluginConfig
) {
  const fragmentName = fragmentDefinitionNode.name.value;
  const fragmentTableName = fragmentDefinitionNode.typeCondition.name.value;
  const relatedTableNamedType = schemaTypeMap[fragmentTableName];

  const relatedTablePrimaryKeyIdField = getPrimaryKeyIdField(relatedTableNamedType);
  if (!relatedTablePrimaryKeyIdField) return;

  injectUpdateReact({
    contentArray,
    importArray,
    entityName: relatedTableNamedType.name,
    fragmentName,
    trimString: config.trimString,
    primaryKeyIdField: relatedTablePrimaryKeyIdField,
    typescriptCodegenOutputPath: config.typescriptCodegenOutputPath
  });
}

// --------------------------------------
//

function makeEntityDeleteMutationTypeScript(
  fragmentDefinitionNode: FragmentDefinitionNode,
  schemaTypeMap: TypeMap,
  importArray: string[],
  contentArray: string[],
  config: CstmHasuraCrudPluginConfig
) {
  const fragmentName = fragmentDefinitionNode.name.value;
  const fragmentTableName = fragmentDefinitionNode.typeCondition.name.value;
  const relatedTableNamedType = schemaTypeMap[fragmentTableName];

  const relatedTablePrimaryKeyIdField = getPrimaryKeyIdField(relatedTableNamedType);
  if (!relatedTablePrimaryKeyIdField) return;

  injectDeleteReact({
    contentArray,
    importArray,
    entityName: relatedTableNamedType.name,
    fragmentName,
    trimString: config.trimString,
    primaryKeyIdField: relatedTablePrimaryKeyIdField,
    typescriptCodegenOutputPath: config.typescriptCodegenOutputPath
  });
}

// --------------------------------------
//
