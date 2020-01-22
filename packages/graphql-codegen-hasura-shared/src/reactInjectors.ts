import { FieldDefinitionNode, FragmentDefinitionNode } from "graphql";
import { getIdTypeScriptFieldType, makeImportStatement, makeModelName, makeShortName, ContentManager } from ".";
import { makeCamelCase, makePascalCase, makeFragmentTypeScriptTypeName, getUniqueEntitiesFromFragmentDefinitions } from "./utils";
import { TypeMap } from "graphql/type/schema";

// ---------------------------------
//
export function injectGlobalReactCodePre({
  contentManager,
  typescriptCodegenOutputPath,
  withUpdates
}: {
  contentManager: ContentManager;
  typescriptCodegenOutputPath: string;
  withUpdates: boolean;
}) {
  contentManager.addImport(`import { ObjectWithId, generateOptimisticResponseForMutation, generateUpdateFunctionForMutation } from 'graphql-codegen-hasura-core'`);
  contentManager.addImport(
    `import { QueryHookOptions, useQuery, LazyQueryHookOptions, useLazyQuery, MutationHookOptions, useMutation, QueryLazyOptions, MutationFunctionOptions, QueryResult, MutationTuple, FetchResult, SubscriptionResult, SubscriptionHookOptions, useSubscription, ApolloError, SubscribeToMoreOptions } from '@apollo/client';`
  );

  contentManager.addContent(`
    // GLOBAL TYPES
    //------------------------------------------------
    export type RemoveEntitiesQueryHookResultEx = { affected_rows:number };
  `);
}

// ---------------------------------
//
export function injectSharedReactPre({
  contentManager,
  entityName,
  fragmentName,
  trimString,
  primaryKeyIdField,
  typescriptCodegenOutputPath
}: {
  contentManager: ContentManager;
  entityName: string;
  fragmentName: string;
  trimString?: string;
  primaryKeyIdField: FieldDefinitionNode;
  typescriptCodegenOutputPath: string;
}) {
  const primaryKeyIdTypeScriptFieldType = getIdTypeScriptFieldType(primaryKeyIdField);
  const fragmentNameCamelCase = makeCamelCase(fragmentName);
  const fragmentTypeScriptTypeName = makeFragmentTypeScriptTypeName(fragmentName);

  contentManager.addContent(`
    // ${entityName} REACT
    //------------------------------------------------

    export type ${fragmentName}ByIdHookResultEx = { ${fragmentNameCamelCase}:${fragmentTypeScriptTypeName} | null | undefined };
    export type ${fragmentName}ObjectsHookResultEx = { objects:${fragmentTypeScriptTypeName}[] };

  `);

  if (!primaryKeyIdTypeScriptFieldType.isNative) {
    const typeImport = makeImportStatement(`${primaryKeyIdTypeScriptFieldType.typeName}`, typescriptCodegenOutputPath);
    contentManager.addImport(typeImport);
  }

  contentManager.addImport(makeImportStatement(fragmentTypeScriptTypeName, typescriptCodegenOutputPath));
}

// ---------------------------------
//
export function injectQueryReact({
  contentManager,
  entityName,
  fragmentName,
  trimString,
  primaryKeyIdField,
  typescriptCodegenOutputPath
}: {
  contentManager: ContentManager;
  entityName: string;
  fragmentName: string;
  trimString?: string;
  primaryKeyIdField?: FieldDefinitionNode | null;
  typescriptCodegenOutputPath: string;
}) {
  const entityShortName = makeShortName(entityName, trimString);
  const entityShortCamelCaseName = makeCamelCase(entityShortName);
  const fragmentNameCamelCase = makeCamelCase(fragmentName);
  const fragmentTypeScriptTypeName = makeFragmentTypeScriptTypeName(fragmentName);
  const queryByIdName = `Query${fragmentName}ById`;
  const queryObjectsName = `Query${fragmentName}Objects`;

  if (primaryKeyIdField) {
    contentManager.addContent(`
    /**
     *  Query Hook
     */

    // Types
    type ${queryByIdName}Result = QueryResult<${queryByIdName}Query, ${queryByIdName}QueryVariables>;
    type ${queryByIdName}SubScribeToMore = (options?: Omit<SubscribeToMoreOptions<${queryByIdName}Query, ${queryByIdName}QueryVariables, ${queryByIdName}Query>, 'document' | 'variables'> | undefined) => void
    export type ${queryByIdName}ResultEx = Omit<${queryByIdName}Result & ${fragmentName}ByIdHookResultEx, 'subscribeToMore'> & { subscribeToMore:${queryByIdName}SubScribeToMore };

    // Function
    function use${queryByIdName}({ ${entityShortCamelCaseName}Id, options }: { ${entityShortCamelCaseName}Id: string; options?: Omit<QueryHookOptions<${queryByIdName}Query, ${queryByIdName}QueryVariables>, "query" | "variables">; }): ${queryByIdName}ResultEx {
      const _query: ${queryByIdName}Result = useQuery<${queryByIdName}Query, ${queryByIdName}QueryVariables>(${queryByIdName}Document, { variables: { ${entityShortCamelCaseName}Id }, ...options });
      
      const subScribeToMoreOverride:${queryByIdName}SubScribeToMore = (options) => { _query.subscribeToMore({document: ${queryByIdName}Document, variables: { ${entityShortCamelCaseName}Id } as ${queryByIdName}QueryVariables, ...options });}
      const { subscribeToMore, ...query } = _query;      
      return { ...query, subscribeToMore:subScribeToMoreOverride, ${fragmentNameCamelCase}: query?.data?.${entityName}_by_pk };
    }
    `);

    contentManager.addContent(`
    /**
     *  Lazy Query Hook
     */
    
    // Types
    type Pick${queryByIdName}Fn = (query: ${queryByIdName}Query | null | undefined) =>${fragmentName}Fragment | null | undefined;
    type ${queryByIdName}LazyFn = [(options?: QueryLazyOptions<${queryByIdName}QueryVariables> | undefined) => void, ${queryByIdName}Result]
    type ${queryByIdName}WrappedLazyFn = (options: Omit<QueryLazyOptions<${queryByIdName}QueryVariables>, "variables">) => void;
    export type ${queryByIdName}LazyReturn = [${queryByIdName}WrappedLazyFn, ${queryByIdName}ResultEx];

    // Function
    function use${queryByIdName}Lazy({ ${entityShortCamelCaseName}Id, options }: { ${entityShortCamelCaseName}Id: string; options?: Omit<QueryHookOptions<${queryByIdName}Query, ${queryByIdName}QueryVariables>, "query" | "variables">; }): ${queryByIdName}LazyReturn {
      const lazyQuery: ${queryByIdName}LazyFn = useLazyQuery<${queryByIdName}Query, ${queryByIdName}QueryVariables>(${queryByIdName}Document, options);
      
      // Setting up typed version of lazyQuery
      const pick${queryByIdName}: Pick${queryByIdName}Fn = query => { return query && query.${entityName}_by_pk; };
      const wrappedLazyQuery: ${queryByIdName}WrappedLazyFn = (options) => { return lazyQuery[0](options); };
      
      // Switching out SubcribeToMore with typed version
      const typedSubcribeToMore:${queryByIdName}SubScribeToMore = (options) => { lazyQuery[1].subscribeToMore({document: ${queryByIdName}Document, variables: { ${entityShortCamelCaseName}Id } as ${queryByIdName}QueryVariables, ...options });}
      const { subscribeToMore, ...lazyQueryResult } = lazyQuery[1];  

      return [wrappedLazyQuery, { ...lazyQueryResult, subscribeToMore:typedSubcribeToMore, ${fragmentNameCamelCase}: pick${queryByIdName}(lazyQuery[1].data) }];
    }
    `);
  }

  contentManager.addContent(`
    /**
     *  Query Collection Hook
     */

    // Types
    export type ${queryObjectsName}Result = QueryResult<${queryObjectsName}Query, ${queryObjectsName}QueryVariables>;
    export type ${queryObjectsName}ResultEx = ${queryObjectsName}Result & ${fragmentName}ObjectsHookResultEx;

    // Function
    function use${queryObjectsName}(options: Omit<QueryHookOptions<${queryObjectsName}Query, ${queryObjectsName}QueryVariables>, "query">): ${queryObjectsName}ResultEx {
      const query:${queryObjectsName}Result = useQuery<${queryObjectsName}Query, ${queryObjectsName}QueryVariables>(${queryObjectsName}Document, options);
      return { ...query, objects: query?.data?.${entityName} || [] };
    }
    `);

  contentManager.addContent(`  
    /**
     *  Lazy Query Collection Hook
     */

    // Types
    type Pick${queryObjectsName}Fn = (query: ${queryObjectsName}Query | null | undefined) => ${fragmentName}Fragment[];
    type ${queryObjectsName}LazyFn = [(options?: QueryLazyOptions<${queryObjectsName}QueryVariables> | undefined) => void, ${queryObjectsName}Result]
    type ${queryObjectsName}WrappedLazyFn = (options?: QueryLazyOptions<${queryObjectsName}QueryVariables>) => void;
    export type ${queryObjectsName}LazyReturn = [${queryObjectsName}WrappedLazyFn, ${queryObjectsName}ResultEx];

    // Function
    function use${queryObjectsName}Lazy(options?: Omit<LazyQueryHookOptions<${queryObjectsName}Query, ${queryObjectsName}QueryVariables>, "query">): ${queryObjectsName}LazyReturn {
      const lazyQuery: ${queryObjectsName}LazyFn = useLazyQuery<${queryObjectsName}Query, ${queryObjectsName}QueryVariables>(${queryObjectsName}Document, options);
      const pickObjects: Pick${queryObjectsName}Fn = (query: ${queryObjectsName}Query | null | undefined) => { return query?.${entityName} || []; };
      const wrappedLazyQuery: ${queryObjectsName}WrappedLazyFn = (options) => { return lazyQuery[0]( options ); };
      return [wrappedLazyQuery, { ...lazyQuery[1], objects: pickObjects(lazyQuery[1].data) }] as [typeof wrappedLazyQuery, typeof lazyQuery[1] & { objects: ReturnType<typeof pickObjects> }];
    }
  `);

  if (primaryKeyIdField) contentManager.addImport(makeImportStatement(`${queryByIdName}Query`, typescriptCodegenOutputPath));
  if (primaryKeyIdField) contentManager.addImport(makeImportStatement(`${queryByIdName}QueryVariables`, typescriptCodegenOutputPath));
  if (primaryKeyIdField) contentManager.addImport(makeImportStatement(`${queryByIdName}Document`, typescriptCodegenOutputPath));
  contentManager.addImport(makeImportStatement(`${queryObjectsName}Query`, typescriptCodegenOutputPath));
  contentManager.addImport(makeImportStatement(`${queryObjectsName}Document`, typescriptCodegenOutputPath));
  contentManager.addImport(makeImportStatement(`${queryObjectsName}QueryVariables`, typescriptCodegenOutputPath));
}

// ---------------------------------
//
export function injectSubscriptionReact({
  contentManager,
  entityName,
  fragmentName,
  trimString,
  primaryKeyIdField,
  typescriptCodegenOutputPath
}: {
  contentManager: ContentManager;
  entityName: string;
  fragmentName: string;
  trimString?: string;
  primaryKeyIdField?: FieldDefinitionNode | null;
  typescriptCodegenOutputPath: string;
}) {
  const entityShortName = makeShortName(entityName, trimString);
  const entityShortCamelCaseName = makeCamelCase(entityShortName);
  const fragmentNameCamelCase = makeCamelCase(fragmentName);
  const fragmentTypeScriptTypeName = makeFragmentTypeScriptTypeName(fragmentName);
  const subscriptionByIdName = `SubscribeTo${fragmentName}ById`;
  const subscriptionByObjectsName = `SubscribeTo${fragmentName}Objects`;

  if (primaryKeyIdField) {
    contentManager.addContent(`     
    /**
     *  Subscription Hook
     */

    // Types
    type ${subscriptionByIdName}Result = { variables: ${subscriptionByIdName}SubscriptionVariables; loading: boolean; data?: ${subscriptionByIdName}Subscription; error?: ApolloError | undefined; };
    export type ${subscriptionByIdName}ResultEx = ${subscriptionByIdName}Result & ${fragmentName}ByIdHookResultEx;

    // Function
    function use${subscriptionByIdName}({ ${entityShortCamelCaseName}Id, options }: { ${entityShortCamelCaseName}Id: string; options?: Omit<SubscriptionHookOptions<${subscriptionByIdName}Subscription, ${subscriptionByIdName}SubscriptionVariables>, "query" | "variables">; }): ${subscriptionByIdName}ResultEx {
      const subscription: ${subscriptionByIdName}Result = useSubscription<${subscriptionByIdName}Subscription, ${subscriptionByIdName}SubscriptionVariables>(${subscriptionByIdName}Document, { variables: { ${entityShortCamelCaseName}Id }, ...options });
      return { ...subscription, ${fragmentNameCamelCase}: subscription?.data?.${entityName}_by_pk };
    }
    `);
  }

  contentManager.addContent(`
    /**
     *  Subscription Collection Hook
     */

    // Types
    export type ${subscriptionByObjectsName}Result = { variables: ${subscriptionByObjectsName}SubscriptionVariables; loading: boolean; data?: ${subscriptionByObjectsName}Subscription; error?: ApolloError | undefined; };
    export type ${subscriptionByObjectsName}ResultEx = ${subscriptionByObjectsName}Result & ${fragmentName}ObjectsHookResultEx;

    // Function
    function use${subscriptionByObjectsName}(options: Omit<SubscriptionHookOptions<${subscriptionByObjectsName}Subscription, ${subscriptionByObjectsName}SubscriptionVariables>, "query">): ${subscriptionByObjectsName}ResultEx {
      const subscription:${subscriptionByObjectsName}Result = useSubscription<${subscriptionByObjectsName}Subscription, ${subscriptionByObjectsName}SubscriptionVariables>(${subscriptionByObjectsName}Document, options);
      return { ...subscription, objects: subscription?.data?.${entityName} || [] };
    }
    `);

  if (primaryKeyIdField) contentManager.addImport(makeImportStatement(`${subscriptionByIdName}Subscription`, typescriptCodegenOutputPath));
  if (primaryKeyIdField) contentManager.addImport(makeImportStatement(`${subscriptionByIdName}SubscriptionVariables`, typescriptCodegenOutputPath));
  if (primaryKeyIdField) contentManager.addImport(makeImportStatement(`${subscriptionByIdName}Document`, typescriptCodegenOutputPath));
  contentManager.addImport(makeImportStatement(`${subscriptionByObjectsName}Subscription`, typescriptCodegenOutputPath));
  contentManager.addImport(makeImportStatement(`${subscriptionByObjectsName}Document`, typescriptCodegenOutputPath));
  contentManager.addImport(makeImportStatement(`${subscriptionByObjectsName}SubscriptionVariables`, typescriptCodegenOutputPath));
}

// ---------------------------------
//
export function injectInsertReact({
  contentManager,
  entityName,
  fragmentName,
  trimString,
  primaryKeyIdField,
  typescriptCodegenOutputPath
}: {
  contentManager: ContentManager;
  entityName: string;
  fragmentName: string;
  trimString?: string;
  primaryKeyIdField: FieldDefinitionNode;
  typescriptCodegenOutputPath: string;
}) {
  const entityPascalName = makePascalCase(entityName);
  const entityShortName = makeShortName(entityName, trimString);
  const entityShortCamelCaseName = makeCamelCase(entityShortName);
  const fragmentNameCamelCase = makeCamelCase(fragmentName);
  const primaryKeyIdTypeScriptFieldType = getIdTypeScriptFieldType(primaryKeyIdField);

  contentManager.addContent(`
    /**
     *  Insert Hooks
     */

    // Types
    type Insert${fragmentName}MutationResult = FetchResult<Insert${fragmentName}Mutation, Record<string, any>, Record<string, any>>;
    export type Insert${fragmentName}MutationResultEx = Insert${fragmentName}MutationResult & ${fragmentName}ByIdHookResultEx;

    type PickInsert${fragmentName}Fn = (mutation: Insert${fragmentName}Mutation | null | undefined) => ${fragmentName}Fragment | null | undefined;
    type Insert${fragmentName}LazyMutationFn = MutationTuple<Insert${fragmentName}Mutation, Insert${fragmentName}MutationVariables>;
    type Insert${fragmentName}WrappedLazyMutationFn = ({ ${entityShortCamelCaseName}, autoOptimisticResponse, options }: { ${entityShortCamelCaseName}: ${entityPascalName}_Insert_Input; autoOptimisticResponse?:boolean, options?: Omit<MutationFunctionOptions<Insert${fragmentName}Mutation, Insert${fragmentName}MutationVariables>, "variables">; }) => Promise<Insert${fragmentName}MutationResultEx>;
    export type Insert${fragmentName}LazyMutationReturn = [Insert${fragmentName}WrappedLazyMutationFn, Insert${fragmentName}MutationResultEx];

    // Function
    function useInsert${fragmentName}(options?: Omit<MutationHookOptions<Insert${fragmentName}Mutation, Insert${fragmentName}MutationVariables>, "mutation" | "variables">): Insert${fragmentName}LazyMutationReturn {
      const lazyMutation: Insert${fragmentName}LazyMutationFn = useMutation<Insert${fragmentName}Mutation, Insert${fragmentName}MutationVariables>(Insert${fragmentName}Document, options);
      const pick${fragmentName}: PickInsert${fragmentName}Fn = (mutation) => { return mutation?.insert_${entityName}?.returning && mutation?.insert_${entityName}?.returning[0]; };

      const wrappedLazyMutation: Insert${fragmentName}WrappedLazyMutationFn = async ({ ${entityShortCamelCaseName}, autoOptimisticResponse, options }) => {
        const mutationOptions:MutationFunctionOptions<Insert${fragmentName}Mutation, Insert${fragmentName}MutationVariables> = { variables: { objects: [${entityShortCamelCaseName}] }, ...options };
        if(autoOptimisticResponse && (!options || !options.optimisticResponse)){ 
          if(!${entityShortCamelCaseName}.id) throw new Error(\`if autoOptimisticResponse = true, id must be set in object '${entityShortCamelCaseName}'\`);
          mutationOptions.optimisticResponse = generateOptimisticResponseForMutation<Insert${fragmentName}Mutation>({ operationType: 'insert', entityName:'${entityShortCamelCaseName}', objects:[${entityShortCamelCaseName} as ${entityPascalName}_Insert_Input & ObjectWithId] 
        }); }

        const fetchResult = await lazyMutation[0](mutationOptions);
        
        return { ...fetchResult, ${fragmentNameCamelCase}: pick${fragmentName}(fetchResult.data) };
      };

      return [wrappedLazyMutation, { ...lazyMutation[1], ${fragmentNameCamelCase}: pick${fragmentName}(lazyMutation[1].data) }];
    }
  `);

  contentManager.addContent(`
    //
    //

    // Types
    type Insert${fragmentName}WithOnConflictLazyMutationFn = MutationTuple<Insert${fragmentName}Mutation, Insert${fragmentName}WithOnConflictMutationVariables>;
    type Insert${fragmentName}WithOnConflictWrappedLazyMutationFn = ({ ${entityShortCamelCaseName}, onConflict, autoOptimisticResponse, options }: { ${entityShortCamelCaseName}: ${entityPascalName}_Insert_Input; onConflict: ${entityPascalName}_On_Conflict, autoOptimisticResponse?:boolean; options?: Omit<MutationFunctionOptions<Insert${fragmentName}Mutation, Insert${fragmentName}WithOnConflictMutationVariables>, "variables">; }) => Promise<Insert${fragmentName}MutationResultEx>;
    export type Insert${fragmentName}WithOnConflictLazyMutationReturn = [Insert${fragmentName}WithOnConflictWrappedLazyMutationFn, Insert${fragmentName}MutationResultEx];

    // Function
    function useInsert${fragmentName}WithOnConflict( options?: Omit<MutationHookOptions<Insert${fragmentName}Mutation, Insert${fragmentName}MutationVariables>, "mutation" | "variables"> ): Insert${fragmentName}WithOnConflictLazyMutationReturn {
      const lazyMutation: Insert${fragmentName}WithOnConflictLazyMutationFn = useMutation<Insert${fragmentName}Mutation, Insert${fragmentName}WithOnConflictMutationVariables>(Insert${fragmentName}WithOnConflictDocument, options);
      const pick${fragmentName}: PickInsert${fragmentName}Fn = (mutation: Insert${fragmentName}Mutation | null | undefined) => { return mutation?.insert_${entityName}?.returning && mutation.insert_${entityName}.returning[0]; };

      const wrappedLazyMutation:Insert${fragmentName}WithOnConflictWrappedLazyMutationFn = async ({ ${entityShortCamelCaseName}, onConflict, autoOptimisticResponse, options }) => {
        const mutationOptions:MutationFunctionOptions<Insert${fragmentName}Mutation, Insert${fragmentName}WithOnConflictMutationVariables> = { variables: { objects: [${entityShortCamelCaseName}], onConflict }, ...options };
        if(autoOptimisticResponse && (!options || !options.optimisticResponse)){ 
          if(!${entityShortCamelCaseName}.id) throw new Error(\`if autoOptimisticResponse = true, id must be set in object '${entityShortCamelCaseName}'\`);
          mutationOptions.optimisticResponse = generateOptimisticResponseForMutation<Insert${fragmentName}Mutation>({ operationType: 'insert', entityName:'${entityShortCamelCaseName}', objects:[${entityShortCamelCaseName} as ${entityPascalName}_Insert_Input & ObjectWithId] }); 
        }

        const fetchResult = await lazyMutation[0](mutationOptions);
        
        return { ...fetchResult, ${fragmentNameCamelCase}: pick${fragmentName}(fetchResult.data) };
      };

      return [wrappedLazyMutation, { ...lazyMutation[1], ${fragmentNameCamelCase}: pick${fragmentName}(lazyMutation[1].data) }];
    }
  `);

  contentManager.addContent(`
    // Types
    type Insert${fragmentName}ObjectsMutationResult = FetchResult<Insert${fragmentName}Mutation, Record<string, any>, Record<string, any>>;
    export type Insert${fragmentName}ObjectsMutationResultEx = Insert${fragmentName}MutationResult & ${fragmentName}ObjectsHookResultEx;

    type PickInsert${fragmentName}ObjectsFn = (mutation: Insert${fragmentName}Mutation | null | undefined) => ${fragmentName}Fragment[];
    type Insert${fragmentName}ObjectsLazyMutationFn = MutationTuple<Insert${fragmentName}Mutation, Insert${fragmentName}MutationVariables>;
    type Insert${fragmentName}ObjectsWrappedLazyMutationFn = (options?: MutationFunctionOptions<Insert${fragmentName}Mutation, Insert${fragmentName}MutationVariables>) => Promise<Insert${fragmentName}ObjectsMutationResultEx>;
    export type Insert${fragmentName}ObjectsLazyMutationReturn = [Insert${fragmentName}ObjectsWrappedLazyMutationFn, Insert${fragmentName}ObjectsMutationResultEx];

    // Function
    function useInsert${fragmentName}Objects(options?: Omit<MutationHookOptions<Insert${fragmentName}Mutation, Insert${fragmentName}MutationVariables>, "mutation">): Insert${fragmentName}ObjectsLazyMutationReturn {
      const lazyMutation: Insert${fragmentName}ObjectsLazyMutationFn = useMutation<Insert${fragmentName}Mutation, Insert${fragmentName}MutationVariables>(Insert${fragmentName}Document, options);
      const pickObjects: PickInsert${fragmentName}ObjectsFn = (mutation: Insert${fragmentName}Mutation | null | undefined) => { return mutation?.insert_${entityName}?.returning || []; };

      const wrappedLazyMutation: Insert${fragmentName}ObjectsWrappedLazyMutationFn = async ( options ) => {
        const fetchResult: Insert${fragmentName}ObjectsMutationResult = await lazyMutation[0](options);
        return { ...fetchResult, objects: pickObjects(fetchResult.data) };
      };

      return [wrappedLazyMutation, { ...lazyMutation[1], objects: pickObjects(lazyMutation[1].data) }];
    }
  `);

  contentManager.addImport(makeImportStatement(`${entityPascalName}_Insert_Input`, typescriptCodegenOutputPath));
  contentManager.addImport(makeImportStatement(`${entityPascalName}_On_Conflict`, typescriptCodegenOutputPath));
  contentManager.addImport(makeImportStatement(`Insert${fragmentName}Mutation`, typescriptCodegenOutputPath));
  contentManager.addImport(makeImportStatement(`Insert${fragmentName}MutationVariables`, typescriptCodegenOutputPath));
  contentManager.addImport(makeImportStatement(`Insert${fragmentName}WithOnConflictMutationVariables`, typescriptCodegenOutputPath));
  contentManager.addImport(makeImportStatement(`Insert${fragmentName}Document`, typescriptCodegenOutputPath));
  contentManager.addImport(makeImportStatement(`Insert${fragmentName}WithOnConflictDocument`, typescriptCodegenOutputPath));
}

// ---------------------------------
//
export function injectUpdateReact({
  contentManager,
  entityName,
  fragmentName,
  trimString,
  primaryKeyIdField,
  typescriptCodegenOutputPath
}: {
  contentManager: ContentManager;
  entityName: string;
  fragmentName: string;
  trimString?: string;
  primaryKeyIdField: FieldDefinitionNode;
  typescriptCodegenOutputPath: string;
}) {
  const entityPascalName = makePascalCase(entityName);
  const entityShortName = makeShortName(entityName, trimString);
  const entityShortCamelCaseName = makeCamelCase(entityShortName);
  const primaryKeyIdTypeScriptFieldType = getIdTypeScriptFieldType(primaryKeyIdField);
  const fragmentNameCamelCase = makeCamelCase(fragmentName);

  contentManager.addContent(`
    /**
     *  Update Hooks
     */
    
    type Update${fragmentName}ByIdMutationResult = FetchResult<Update${fragmentName}ByIdMutation, Record<string, any>, Record<string, any>>;
    export type Update${fragmentName}ByIdMutationResultEx = Update${fragmentName}ByIdMutationResult & ${fragmentName}ByIdHookResultEx;

    type PickUpdate${fragmentName}ByIdFn = (mutation: Update${fragmentName}ByIdMutation | null | undefined) => ${fragmentName}Fragment | null | undefined;
    type Update${fragmentName}ByIdLazyMutationFn = MutationTuple<Update${fragmentName}ByIdMutation, Update${fragmentName}ByIdMutationVariables>;
    type Update${fragmentName}ByIdWrappedLazyMutationFn = ({ ${entityShortCamelCaseName}Id, set, autoOptimisticResponse, options }: { ${entityShortCamelCaseName}Id: string; set: ${entityPascalName}_Set_Input; autoOptimisticResponse?: boolean; options?: Omit<MutationFunctionOptions<Update${fragmentName}ByIdMutation, Update${fragmentName}ByIdMutationVariables>, "variables">; }) => Promise<Update${fragmentName}ByIdMutationResultEx>;
    export type Update${fragmentName}ByIdLazyMutationReturn = [Update${fragmentName}ByIdWrappedLazyMutationFn, Update${fragmentName}ByIdMutationResultEx];

    function useUpdate${fragmentName}ById(options?: Omit<MutationHookOptions<Update${fragmentName}ByIdMutation, Update${fragmentName}ByIdMutationVariables>, "mutation" | "variables">): Update${fragmentName}ByIdLazyMutationReturn {
      const lazyMutation: Update${fragmentName}ByIdLazyMutationFn = useMutation<Update${fragmentName}ByIdMutation, Update${fragmentName}ByIdMutationVariables>(Update${fragmentName}ByIdDocument, options);

      const pick${fragmentName}: PickUpdate${fragmentName}ByIdFn = (mutation) => { return mutation?.update_${entityName}?.returning && mutation.update_${entityName}!.returning[0]; };

      const wrappedLazyMutation: Update${fragmentName}ByIdWrappedLazyMutationFn = async ({ ${entityShortCamelCaseName}Id, set, autoOptimisticResponse, options }) => {
        const mutationOptions: MutationFunctionOptions<Update${fragmentName}ByIdMutation, Update${fragmentName}ByIdMutationVariables> = { variables: { id: ${entityShortCamelCaseName}Id, set }, ...options };
        if (autoOptimisticResponse && (!options || !options.optimisticResponse)) {
          mutationOptions.optimisticResponse = generateOptimisticResponseForMutation<Update${fragmentName}ByIdMutation>({ operationType: 'update', entityName:'${entityName}', objects:[{ id:${entityShortCamelCaseName}Id, ...set }] });
        }

        const fetchResult: Update${fragmentName}ByIdMutationResult = await lazyMutation[0]({ variables: { id: ${entityShortCamelCaseName}Id, set }, ...mutationOptions });
        return { ...fetchResult, ${fragmentNameCamelCase}: pick${fragmentName}(fetchResult.data) };
      };

      return [wrappedLazyMutation, { ...lazyMutation[1], ${fragmentNameCamelCase}: pick${fragmentName}(lazyMutation[1].data) }];
    }
  `);

  contentManager.addContent(`
    //
    //

    // Types
    type Update${fragmentName}ObjectsMutationResult = FetchResult<Update${fragmentName}Mutation, Record<string, any>, Record<string, any>>;
    export type Update${fragmentName}ObjectsMutationResultEx = Update${fragmentName}ObjectsMutationResult & ${fragmentName}ObjectsHookResultEx;

    // Function
    type PickUpdate${fragmentName}ObjectsFn = (mutation: Update${fragmentName}Mutation | null | undefined) => ${fragmentName}Fragment[];
    type Update${fragmentName}ObjectsLazyMutationFn = MutationTuple<Update${fragmentName}Mutation, Update${fragmentName}MutationVariables>;
    type Update${fragmentName}ObjectsWrappedLazyMutationFn = (options?: MutationFunctionOptions<Update${fragmentName}Mutation, Update${fragmentName}MutationVariables>) => Promise<Update${fragmentName}ObjectsMutationResultEx>;
    export type Update${fragmentName}ObjectsLazyMutationReturn = [Update${fragmentName}ObjectsWrappedLazyMutationFn, Update${fragmentName}ObjectsMutationResultEx];

    function useUpdate${fragmentName}Objects(options?: Omit<MutationHookOptions<Update${fragmentName}Mutation, Update${fragmentName}MutationVariables>, "mutation">): Update${fragmentName}ObjectsLazyMutationReturn {
      const lazyMutation: Update${fragmentName}ObjectsLazyMutationFn = useMutation<Update${fragmentName}Mutation, Update${fragmentName}MutationVariables>(Update${fragmentName}Document, options);

      const pickObjects: PickUpdate${fragmentName}ObjectsFn = (mutation: Update${fragmentName}Mutation | null | undefined) => {
        return mutation?.update_${entityName}?.returning || [];
      };

      const wrappedLazyMutation: Update${fragmentName}ObjectsWrappedLazyMutationFn = async (options) => {
        const fetchResult: Update${fragmentName}ObjectsMutationResult = await lazyMutation[0](options);
        return { ...fetchResult, objects: pickObjects(fetchResult.data) };
      };

      return [wrappedLazyMutation, { ...lazyMutation[1], objects: pickObjects(lazyMutation[1].data) }];
    }
  `);

  contentManager.addImport(makeImportStatement(`${entityPascalName}_Set_Input`, typescriptCodegenOutputPath));
  contentManager.addImport(makeImportStatement(`Update${fragmentName}ByIdMutation`, typescriptCodegenOutputPath));
  contentManager.addImport(makeImportStatement(`Update${fragmentName}ByIdMutationVariables`, typescriptCodegenOutputPath));
  contentManager.addImport(makeImportStatement(`Update${fragmentName}ByIdDocument`, typescriptCodegenOutputPath));
  contentManager.addImport(makeImportStatement(`Update${fragmentName}Mutation`, typescriptCodegenOutputPath));
  contentManager.addImport(makeImportStatement(`Update${fragmentName}MutationVariables`, typescriptCodegenOutputPath));
  contentManager.addImport(makeImportStatement(`Update${fragmentName}Document`, typescriptCodegenOutputPath));
}

// ---------------------------------
//
export function injectDeleteReact({
  contentManager,
  entityName,
  fragmentName,
  trimString,
  primaryKeyIdField,
  typescriptCodegenOutputPath
}: {
  contentManager: ContentManager;
  entityName: string;
  fragmentName: string;
  trimString?: string;
  primaryKeyIdField: FieldDefinitionNode;
  typescriptCodegenOutputPath: string;
}) {
  const entityShortName = makeShortName(entityName, trimString);
  const entityShortCamelCaseName = makeCamelCase(entityShortName);
  const entityModelName = makeModelName(entityName, trimString);
  const primaryKeyIdTypeScriptFieldType = getIdTypeScriptFieldType(primaryKeyIdField);
  const fragmentNameCamelCase = makeCamelCase(fragmentName);
  const entityPascalName = makePascalCase(entityName);

  contentManager.addContent(`
    /**
     *  Delete Hooks
     */

    // Types
    type Remove${entityModelName}ByIdFetchResult = FetchResult<Remove${entityModelName}ByIdMutation, Record<string, any>, Record<string, any>>;
    export type Remove${entityModelName}ByIdMutationResultEx = Remove${entityModelName}ByIdFetchResult & RemoveEntitiesQueryHookResultEx;

    // Function
    type PickRemove${entityModelName}Fn = (mutation: Remove${entityModelName}ByIdMutation | null | undefined) => number;
    type Remove${entityModelName}LazyMutationFn = MutationTuple<Remove${entityModelName}ByIdMutation, Remove${entityModelName}ByIdMutationVariables>;
    type Remove${entityModelName}WrappedLazyMutationFn = ({ ${entityShortCamelCaseName}Id, autoOptimisticResponse, options }: { ${entityShortCamelCaseName}Id: string; autoOptimisticResponse?:boolean, options?: Omit<MutationFunctionOptions<Remove${entityModelName}ByIdMutation, Remove${entityModelName}ByIdMutationVariables>, "variables">; }) => Promise<Remove${entityModelName}ByIdMutationResultEx>;
    export type Remove${entityModelName}LazyMutationReturn = [Remove${entityModelName}WrappedLazyMutationFn, Remove${entityModelName}ByIdMutationResultEx];

    function useRemove${entityModelName}ById(options?: Omit<MutationHookOptions<Remove${entityModelName}ByIdMutation, Remove${entityModelName}ByIdMutationVariables>, "mutation" | "variables">) {
      const lazyMutation: Remove${entityModelName}LazyMutationFn = useMutation<Remove${entityModelName}ByIdMutation, Remove${entityModelName}ByIdMutationVariables>(Remove${entityModelName}ByIdDocument, options);
      
      const pickAffectedRows: PickRemove${entityModelName}Fn = (mutation: Remove${entityModelName}ByIdMutation | null | undefined) => {
        return mutation?.delete_${entityName}?.affected_rows || 0;
      };

      const wrappedLazyMutation: Remove${entityModelName}WrappedLazyMutationFn = async ({ ${entityShortCamelCaseName}Id, autoOptimisticResponse, options }) => {
        const mutationOptions:MutationFunctionOptions<Remove${entityModelName}Mutation, Remove${entityModelName}ByIdMutationVariables> = { variables: { id: ${entityShortCamelCaseName}Id }, ...options };
        if(autoOptimisticResponse && (!options || !options.optimisticResponse)){ mutationOptions.optimisticResponse = generateOptimisticResponseForMutation<Remove${entityModelName}Mutation>({ operationType: 'delete', entityName:'${entityShortCamelCaseName}', objects:[{ id:${entityShortCamelCaseName}Id }] });        }
        if((!options || !options.update)){ mutationOptions.update = generateUpdateFunctionForMutation<Remove${entityModelName}ByIdMutation>({ operationType: 'delete', entityName:'${entityShortCamelCaseName}', entityId:${entityShortCamelCaseName}Id }); }
        
        const fetchResult: Remove${entityModelName}ByIdFetchResult = await lazyMutation[0](mutationOptions);
        return { ...fetchResult, affected_rows: pickAffectedRows(fetchResult.data) };
      };

      return [wrappedLazyMutation, { ...lazyMutation[1], affected_rows: pickAffectedRows(lazyMutation[1].data) }] as [
        typeof wrappedLazyMutation,
        typeof lazyMutation[1] & { affected_rows: ReturnType<typeof pickAffectedRows> }
      ];
    }
  `);

  contentManager.addContent(`
    //
    //

    // Types
    type Remove${entityModelName}ObjectsMutationResult = FetchResult<Remove${entityModelName}Mutation, Record<string, any>, Record<string, any>>;
    export type Remove${entityModelName}ObjectsMutationResultEx = Remove${entityModelName}ObjectsMutationResult & RemoveEntitiesQueryHookResultEx;

    // Function
    type PickRemove${entityModelName}ObjectsFn = (mutation: Remove${entityModelName}Mutation | null | undefined) => number;
    type Remove${entityModelName}ObjectsLazyMutationFn = MutationTuple<Remove${entityModelName}Mutation, Remove${entityModelName}MutationVariables>;
    type Remove${entityModelName}ObjectsWrappedLazyMutationFn = (options: MutationFunctionOptions<Remove${entityModelName}Mutation, Remove${entityModelName}MutationVariables>) => Promise<Remove${entityModelName}ObjectsMutationResultEx>;
    export type Remove${entityModelName}ObjectsLazyMutationReturn = [Remove${entityModelName}ObjectsWrappedLazyMutationFn, Remove${entityModelName}ObjectsMutationResultEx];

    function useRemove${entityModelName}Objects(options?: Omit<MutationHookOptions<Remove${entityModelName}Mutation, Remove${entityModelName}MutationVariables>, "mutation">): Remove${entityModelName}ObjectsLazyMutationReturn {
      const lazyMutation = useMutation<Remove${entityModelName}Mutation, Remove${entityModelName}MutationVariables>(Remove${entityModelName}Document, options);

      const pickAffectedRows: PickRemove${entityModelName}ObjectsFn = (mutation: Remove${entityModelName}Mutation | null | undefined) => {
        return mutation?.delete_${entityName}?.affected_rows || 0;
      };

      const wrappedLazyMutation: Remove${entityModelName}ObjectsWrappedLazyMutationFn = async (options) => {
        const fetchResult: Remove${entityModelName}ObjectsMutationResult = await lazyMutation[0](options);
        return { ...fetchResult, affected_rows: pickAffectedRows(fetchResult.data) };
      };

      return [wrappedLazyMutation, { ...lazyMutation[1], affected_rows: pickAffectedRows(lazyMutation[1].data) }];
    }
  `);

  contentManager.addImport(makeImportStatement(`Remove${entityModelName}Mutation`, typescriptCodegenOutputPath));
  contentManager.addImport(makeImportStatement(`Remove${entityModelName}MutationVariables`, typescriptCodegenOutputPath));
  contentManager.addImport(makeImportStatement(`Remove${entityModelName}Document`, typescriptCodegenOutputPath));
  contentManager.addImport(makeImportStatement(`Remove${entityModelName}ByIdMutation`, typescriptCodegenOutputPath));
  contentManager.addImport(makeImportStatement(`Remove${entityModelName}ByIdMutationVariables`, typescriptCodegenOutputPath));
  contentManager.addImport(makeImportStatement(`Remove${entityModelName}ByIdDocument`, typescriptCodegenOutputPath));
}

// ---------------------------------
//
export function injectSharedReactPost({
  contentManager,
  entityName,
  fragmentName,
  trimString,
  primaryKeyIdField,
  typescriptCodegenOutputPath,
  withQueries,
  withInserts,
  withUpdates,
  withDeletes
}: {
  contentManager: ContentManager;
  entityName: string;
  fragmentName: string;
  trimString?: string;
  primaryKeyIdField: FieldDefinitionNode;
  typescriptCodegenOutputPath: string;
  withQueries?: boolean;
  withInserts?: boolean;
  withUpdates?: boolean;
  withDeletes?: boolean;
}) {
  const entityModelName = makeModelName(entityName, trimString);
  const queryByIdName = `Query${fragmentName}ById`;
  const queryObjectsName = `Query${fragmentName}Objects`;

  (withQueries || withInserts || withUpdates) &&
    contentManager.addContent(`
    /*
     * ${fragmentName} FRAGMENT HOOKS OBJECT
     */

    export const ${fragmentName}FragmentGQLHooks = {
      ${withQueries && `useQueryById: use${queryByIdName}`},
      ${withQueries && `useQueryByIdLazy: use${queryByIdName}Lazy`},
      ${withQueries && `useQueryObjects: use${queryObjectsName}`},
      ${withQueries && `useQueryObjectsLazy: use${queryObjectsName}Lazy`},
      ${withInserts && `useInsert: useInsert${fragmentName}`},
      ${withInserts && `useInsertWithOnConflict: useInsert${fragmentName}WithOnConflict`},
      ${withInserts && `useInsertObjects: useInsert${fragmentName}Objects`},
      ${withUpdates && `useUpdateById: useUpdate${fragmentName}ById`},
      ${withUpdates && `useUpdateObjects: useUpdate${fragmentName}Objects`},
    }
  `);

  if (withDeletes) {
    contentManager.addContent(`
    /*
    * ${entityName} MODEL HOOKS OBJECT
    */

    export const ${entityModelName}GQLHooks = {
      ${withDeletes && `useRemoveById: useRemove${entityModelName}ById`},
      ${withDeletes && `useRemoveObjects: useRemove${entityModelName}Objects`}
    }
  `);
  }
}

// ---------------------------------
//
export function injectGlobalReactCodePost({
  contentManager,
  fragmentDefinitionNodes,
  schemaTypeMap,
  trimString,
  withQueries,
  withInserts,
  withUpdates,
  withDeletes
}: {
  contentManager: ContentManager;
  fragmentDefinitionNodes: FragmentDefinitionNode[];
  schemaTypeMap: TypeMap;
  trimString?: string;
  withQueries?: boolean;
  withInserts?: boolean;
  withUpdates?: boolean;
  withDeletes?: boolean;
}) {
  const uniqueModelNamesFromFragments = getUniqueEntitiesFromFragmentDefinitions({ fragmentDefinitionNodes, schemaTypeMap, trimString }).map(
    entityName => `${makeModelName(entityName, trimString)}`
  );

  contentManager.addContent(`
    /*
     * COMBINED HOOKS OBJECT
     */
    export const GQLHooks = {
      ${
        withQueries || withInserts || withUpdates
          ? `Fragments: {
        ${fragmentDefinitionNodes
          .map(
            fragmentDefinitionNode =>
              `${makeShortName(fragmentDefinitionNode.name.value, trimString)}: ${makeShortName(fragmentDefinitionNode.name.value, trimString)}FragmentGQLHooks`
          )
          .join(",\n        ")}
      },`
          : ""
      }
      ${
        withDeletes
          ? `Models: {
        ${uniqueModelNamesFromFragments.map(modelName => `${modelName}: ${modelName}GQLHooks`).join(",\n        ")}
      }`
          : ""
      }
    }
  `);
}
