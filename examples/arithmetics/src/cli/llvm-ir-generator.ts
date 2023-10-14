/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CompositeGeneratorNode, toString } from 'langium';
import { type Definition, type Evaluation, isDefinition, type Module, type Statement } from '../language-server/generated/ast.js';
import { type Expression, isNumberLiteral } from '../language-server/generated/ast.js';
import llvm from 'llvm-bindings';

type LLVMData = {
    context: llvm.LLVMContext,
    module: llvm.Module,
    builder: llvm.IRBuilder,
}

const CustomLLVMConfig = {
    TARGET_TRIPLE: 'arm64-apple-macosx14.0.0'
};

export function generateLLVMIR(exprSet: Module, fileName: string): string {
    const context = new llvm.LLVMContext();
    const module = new llvm.Module(fileName, context);
    // TODO: returns not correct target triple
    // module.setTargetTriple(llvm.config.LLVM_DEFAULT_TARGET_TRIPLE);
    module.setTargetTriple(CustomLLVMConfig.TARGET_TRIPLE);
    const builder = new llvm.IRBuilder(context);
    const llvmData = { context, module, builder };

    setupExternFunctions(llvmData);

    const fileNode = new CompositeGeneratorNode();
    fileNode.append(generateLLVMIRinternal(exprSet.statements, llvmData));

    return toString(fileNode);
}

function setupExternFunctions(llvmData: LLVMData) {
    const bytePtrTy: llvm.PointerType[] = [llvmData.builder.getInt8PtrTy()];

    llvmData.module.getOrInsertFunction('printf', llvm.FunctionType.get(
        /* return type */ llvmData.builder.getInt32Ty(),
        /* foramt arg */ bytePtrTy,
        /* vararg */ true
    ));
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

    const str = builder.CreateGlobalStringPtr('HelloWorld', 'str', 0, module);
    const printfFn = llvmData.module.getFunction('printf');
    if (printfFn) {
        llvmData.builder.CreateCall(printfFn, [str], 'qwe');
    }

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
