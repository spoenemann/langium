/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CompositeGeneratorNode, toString } from 'langium';
import { type Definition, type Evaluation, type Module, type Statement, isEvaluation, type Expression, isFunctionCall } from '../language-server/generated/ast.js';
import { isNumberLiteral } from '../language-server/generated/ast.js';
import llvm from 'llvm-bindings';

type LLVMData = {
    context: llvm.LLVMContext,
    module: llvm.Module,
    builder: llvm.IRBuilder,
    globalVars: Map<string, llvm.Constant>,
    mainVars: Map<string, llvm.Value>,
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
    const globalVars = new Map<string, llvm.Constant>();
    const mainVars = new Map<string, llvm.Value>();

    const llvmData = { context, module, builder, globalVars, mainVars };
    setupExternFunctions(llvmData);

    const fileNode = new CompositeGeneratorNode();
    fileNode.append(generateLLVMIRinternal(exprSet.statements, llvmData));

    return toString(fileNode);
}

function setupExternFunctions(llvmData: LLVMData) {
    const float_modifier_name = 'float_modifier';
    const float_modifier = llvmData.builder.CreateGlobalStringPtr('%f\n', float_modifier_name, 0, llvmData.module);
    llvmData.globalVars.set(float_modifier_name, float_modifier);

    const bytePtrTy: llvm.PointerType[] = [llvmData.builder.getInt8PtrTy()];
    llvmData.module.getOrInsertFunction('printf', llvm.FunctionType.get(
        /* return type */ llvmData.builder.getInt32Ty(),
        /* foramt arg */  bytePtrTy,
        /* vararg */      true
    ));

    llvmData.module.getOrInsertFunction('pow', llvm.FunctionType.get(
        /* return type */ llvmData.builder.getDoubleTy(),
        /* foramt arg */  [llvmData.builder.getDoubleTy(), llvmData.builder.getDoubleTy()],
        /* vararg */      true
    ));
}

function generateLLVMIRinternal(statements: Statement[], llvmData: LLVMData): string {
    const { functions, variables, evaluations } = splitEntities(statements);
    functions.forEach(func => generateFunction(func, llvmData));
    generateMainFunction(variables, evaluations, llvmData);

    if (llvm.verifyModule(llvmData.module)) {
        return 'Verifying module failed';
    }
    return llvmData.module.print();
}

function generateMainFunction(variables: Definition[], evaluations: Evaluation[], llvmData: LLVMData): void {
    const { context, module, builder } = llvmData;

    const returnType = builder.getInt64Ty();
    const functionType = llvm.FunctionType.get(returnType, [], false);
    const mainFunc = llvm.Function.Create(functionType, llvm.Function.LinkageTypes.ExternalLinkage, 'main', module);

    const entryBB = llvm.BasicBlock.Create(context, 'entry', mainFunc);
    builder.SetInsertPoint(entryBB);

    variables.forEach(v => generateVariables(v, llvmData));
    evaluations.forEach(e => generateEvaluation(e.expression, llvmData));

    builder.CreateRet(llvmData.builder.getInt64(0));

    if (llvm.verifyFunction(mainFunc)) {
        throw new Error('LLVM IR generation: function generatation failed.');
    }
}

function generateVariables(variable: Definition, llvmData: LLVMData): void {
    const { builder, mainVars } = llvmData;

    const result = generateExpression(variable.expr, llvmData, mainVars);

    const floatAlloca = builder.CreateAlloca(builder.getDoubleTy(), null, variable.name);
    builder.CreateStore(result, floatAlloca);
    const loadedValue = builder.CreateLoad(builder.getDoubleTy(), floatAlloca);
    llvmData.mainVars.set(variable.name, loadedValue);
}

function generateEvaluation(expr: Expression, llvmData: LLVMData): void {
    const { module, builder, globalVars, mainVars } = llvmData;

    const result = generateExpression(expr, llvmData, mainVars);

    const printfFn = module.getFunction('printf')!;
    if (printfFn) {
        builder.CreateCall(printfFn, [globalVars.get('float_modifier')!, result]);
    } else {
        throw new Error('LLVM IR generation: \'printf\' was not found.');
    }
}

function generateFunction(def: Definition, llvmData: LLVMData): void {
    const { context, module, builder } = llvmData;

    const returnType = builder.getDoubleTy();
    const paramTypes: llvm.Type[] = def.args.map(_ => builder.getDoubleTy());
    const functionType = llvm.FunctionType.get(returnType, paramTypes, false);
    const func = llvm.Function.Create(functionType, llvm.Function.LinkageTypes.ExternalLinkage, def.name, module);

    const entryBB = llvm.BasicBlock.Create(context, 'entry', func);
    builder.SetInsertPoint(entryBB);

    const namedValues = new Map<string, llvm.Argument>();
    for (let i = 0; i < def.args.length; i++) {
        namedValues.set(def.args[i].name, func.getArg(i));
    }
    const result = generateExpression(def.expr, llvmData, namedValues);
    builder.CreateRet(result);

    if (llvm.verifyFunction(func)) {
        throw new Error(`LLVM IR generation: function generatation failed: '${def.name}'.`);
    }
}

function generateExpression(expr: Expression, llvmData: LLVMData, namedValues: Map<string, llvm.Value>): llvm.Value {
    const { builder, module } = llvmData;

    if (isNumberLiteral(expr)) {
        return llvm.ConstantFP.get(builder.getDoubleTy(), expr.value);
    } else if (isFunctionCall(expr)) {
        const funcName = expr.func.ref?.name;
        if (funcName) {
            const arg = namedValues.get(funcName);
            if (arg) {
                return arg;
            } else {
                const func = module.getFunction(funcName);
                if (func) {
                    const args = expr.args.map(e => generateExpression(e, llvmData, namedValues));
                    return builder.CreateCall(func, args);
                }
            }
        }
        throw new Error(`LLVM IR generation: no function '${expr.func.$refText}' [the case must be covered by the validator].`);
    } else {
        const left = generateExpression(expr.left, llvmData, namedValues);
        const right = generateExpression(expr.right, llvmData, namedValues);
        if (expr.operator === '+') {
            return builder.CreateFAdd(left, right);
        } else if (expr.operator === '-') {
            return builder.CreateFSub(left, right);
        } else if (expr.operator === '*') {
            return builder.CreateFMul(left, right);
        } else if (expr.operator === '/') {
            return builder.CreateFDiv(left, right);
        } else if (expr.operator === '%') {
            return builder.CreateFRem(left, right);
        } else {
            const pow = module.getFunction('pow');
            if (pow) {
                return builder.CreateCall(pow, [left, right]);
            } else {
                throw new Error('LLVM IR generation: \'pow\' was not found.');
            }
        }
    }
}

type Entities = {
    functions: Definition[],
    variables: Definition[],
    evaluations: Evaluation[]
}

function splitEntities(statements: Statement[]): Entities {
    const res = { functions: [], variables: [], evaluations: [] } as Entities;
    for (const stmt of statements) {
        if (isEvaluation(stmt)) {
            res.evaluations.push(stmt);
        } else {
            stmt.args.length === 0 ?
                res.variables.push(stmt) :
                res.functions.push(stmt);
        }
    }
    return res;
}
