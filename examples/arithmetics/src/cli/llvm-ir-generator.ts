/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CompositeGeneratorNode, toString } from 'langium';
import { type Definition, type Evaluation, isDefinition, type Module, type Statement, type Expression, isNumberLiteral } from '../language-server/generated/ast.js';
import llvm from 'llvm-bindings';

type LLVMData = {
    context: llvm.LLVMContext,
    module: llvm.Module,
    builder: llvm.IRBuilder,
}

export function generateLLVMIR(exprSet: Module): string {
    const context = new llvm.LLVMContext();
    const module = new llvm.Module(exprSet.name, context);
    const builder = new llvm.IRBuilder(context);

    const fileNode = new CompositeGeneratorNode();
    fileNode.append(generateLLVMIRinternal(exprSet.statements, { context, module, builder }));

    return toString(fileNode);
}

function generateLLVMIRinternal(statements: Statement[], llvmData: LLVMData): string {
    const { module } = llvmData;

    statements.forEach(stmt => generateStatement(stmt, llvmData));

    if (llvm.verifyModule(module)) {
        return 'Verifying module failed';
    }
    return module.print();
}

function generateStatement(stmt: Statement, llvmData: LLVMData): void {
    if (isDefinition(stmt)) {
        generateDefinition(stmt, llvmData);
    } else {
        generateEvaluation(stmt, llvmData);
    }
}

function generateDefinition(def: Definition, llvmData: LLVMData): void {
    const { context, module, builder } = llvmData;

    const returnType = builder.getInt64Ty();
    const paramTypes: llvm.Type[] = def.args.map(_ => builder.getInt64Ty());
    const functionType = llvm.FunctionType.get(returnType, paramTypes, false);
    const func = llvm.Function.Create(functionType, llvm.Function.LinkageTypes.ExternalLinkage, def.name, module);

    const entryBB = llvm.BasicBlock.Create(context, 'main', func);
    builder.SetInsertPoint(entryBB);

    const namedValues = new Map<string, llvm.Argument>();
    for (let i = 0; i < def.args.length; i++) {
        namedValues.set(def.args[i].name, func.getArg(i));
    }
    const result = generateExpression(def.expr, llvmData, namedValues);
    builder.CreateRet(result);

    if (llvm.verifyFunction(func)) {
        throw new Error('Error: LLVM IR generation: function generatation failed!');
    }
}

function generateExpression(expr: Expression, llvmData: LLVMData, namedValues: Map<string, llvm.Argument>): llvm.Value {
    if (isNumberLiteral(expr)) {
        return llvmData.builder.getInt64(expr.value);
    } else {
        namedValues;
    }
    throw new Error('Error: LLVM IR generation: the case must be covered by the validator!');
}

function generateEvaluation(evalAction: Evaluation, llvmData: LLVMData): void {
    evalAction; llvmData;
}
