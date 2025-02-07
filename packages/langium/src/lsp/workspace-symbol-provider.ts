/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { WorkspaceSymbol, WorkspaceSymbolParams } from 'vscode-languageserver';
import type { LangiumSharedServices } from '../services.js';
import type { IndexManager } from '../workspace/index-manager.js';
import type { MaybePromise} from '../utils/promise-util.js';
import type { AstNodeDescription } from '../syntax-tree.js';
import type { NodeKindProvider } from './node-kind-provider.js';
import type { FuzzyMatcher } from './fuzzy-matcher.js';
import { CancellationToken } from 'vscode-languageserver';
import { interruptAndCheck } from '../utils/promise-util.js';

/**
 * Shared service for handling workspace symbols requests.
 */
export interface WorkspaceSymbolProvider {
    /**
     * Handle a workspace symbols request.
     *
     * @throws `OperationCancelled` if cancellation is detected during execution
     * @throws `ResponseError` if an error is detected that should be sent as response to the client
     */
    getSymbols(params: WorkspaceSymbolParams, cancelToken?: CancellationToken): MaybePromise<WorkspaceSymbol[]>;
    /**
     * Handle a resolve request for a workspace symbol.
     *
     * @throws `OperationCancelled` if cancellation is detected during execution
     * @throws `ResponseError` if an error is detected that should be sent as response to the client
     */
    resolveSymbol?(symbol: WorkspaceSymbol, cancelToken?: CancellationToken): MaybePromise<WorkspaceSymbol>;
}

export class DefaultWorkspaceSymbolProvider implements WorkspaceSymbolProvider {

    protected readonly indexManager: IndexManager;
    protected readonly nodeKindProvider: NodeKindProvider;
    protected readonly fuzzyMatcher: FuzzyMatcher;

    constructor(services: LangiumSharedServices) {
        this.indexManager = services.workspace.IndexManager;
        this.nodeKindProvider = services.lsp.NodeKindProvider;
        this.fuzzyMatcher = services.lsp.FuzzyMatcher;
    }

    async getSymbols(params: WorkspaceSymbolParams, cancelToken = CancellationToken.None): Promise<WorkspaceSymbol[]> {
        const workspaceSymbols: WorkspaceSymbol[] = [];
        const query = params.query.toLowerCase();
        for (const description of this.indexManager.allElements()) {
            await interruptAndCheck(cancelToken);
            if (this.fuzzyMatcher.match(query, description.name)) {
                const symbol = this.getWorkspaceSymbol(description);
                if (symbol) {
                    workspaceSymbols.push(symbol);
                }
            }
        }
        return workspaceSymbols;
    }

    protected getWorkspaceSymbol(astDescription: AstNodeDescription): WorkspaceSymbol | undefined {
        const nameSegment = astDescription.nameSegment;
        if (nameSegment) {
            return {
                kind: this.nodeKindProvider.getSymbolKind(astDescription),
                name: astDescription.name,
                location: {
                    range: nameSegment.range,
                    uri: astDescription.documentUri.toString()
                }
            };
        } else {
            return undefined;
        }
    }
}
