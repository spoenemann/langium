/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CompositeGeneratorNode, toString } from 'langium';
import { type Definition, type Evaluation, type Module, type Statement, isEvaluation, type Expression, isBinaryExpression, isFunctionCall } from '../language-server/generated/ast.js';
import { isNumberLiteral } from '../language-server/generated/ast.js';
import llvm from 'llvm-bindings';

type LLVMData = {
    context: llvm.LLVMContext,
    module: llvm.Module,
    builder: llvm.IRBuilder,
    globalVars: Map<string, llvm.Constant>,
    mainVars: Map<string, llvm.AllocaInst>
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
    const mainVars = new Map<string, llvm.AllocaInst>();
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
}

function generateLLVMIRinternal(statements: Statement[], llvmData: LLVMData): string {
    const { module } = llvmData;

    const functions = [];
    const variables = [];
    const evaluations = [];
    for (const stmt of statements) {
        if (isEvaluation(stmt)) {
            evaluations.push(stmt);
        } else {
            if (stmt.args.length === 0) {
                variables.push(stmt);
            } else {
                functions.push(stmt);
            }
        }
    }

    // functions.forEach(func => generateFunction(func, llvmData));
    generateMainFunction(variables, evaluations, llvmData);

    if (llvm.verifyModule(module)) {
        return 'Verifying module failed';
    }
    return module.print();
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
        throw new Error('Error: LLVM IR generation: function generatation failed!');
    }
}

function generateVariables(variable: Definition, {builder, mainVars}: LLVMData): void {
    if (isNumberLiteral(variable.expr)) {
        const floatAlloca = builder.CreateAlloca(builder.getDoubleTy(), null, variable.name);
        builder.CreateStore(llvm.ConstantFP.get(builder.getDoubleTy(), variable.expr.value), floatAlloca);
        mainVars.set(variable.name, floatAlloca);
    }
}

function generateEvaluation(expr: Expression, llvmData: LLVMData): void {
    const {module, builder, globalVars, mainVars} = llvmData;

    const printfFn = module.getFunction('printf');
    if (!printfFn) return;
    const float_modifier = globalVars.get('float_modifier')!;

    if (isNumberLiteral(expr)) {
        builder.CreateCall(printfFn, [float_modifier, llvm.ConstantFP.get(builder.getDoubleTy(), expr.value)]);
    } else if (isBinaryExpression(expr)) {
        if (expr.operator === '+' && isFunctionCall(expr.left) && isFunctionCall(expr.right) && expr.left.args.length === 0 && expr.right.args.length === 0) {
            const a = expr.left.func.ref?.name;
            const b = expr.right.func.ref?.name;
            if (a && b) {
                const allocaInstA = mainVars.get(a);
                const allocaInstB = mainVars.get(b);
                if (allocaInstA && allocaInstB) {
                    const valueA = builder.CreateLoad(builder.getDoubleTy(), allocaInstA, a);
                    const valueB = builder.CreateLoad(builder.getDoubleTy(), allocaInstB, b);
                    const res = builder.CreateFAdd(valueA, valueB, `sum_${a}_${b}`);
                    builder.CreateCall(printfFn, [float_modifier, res]);
                }
            }
        }
    }
}

// function generateFunction(def: Definition, llvmData: LLVMData): void {
//     const { context, module, builder } = llvmData;

//     const returnType = builder.getInt64Ty();
//     const paramTypes: llvm.Type[] = def.args.map(_ => builder.getInt64Ty());
//     const functionType = llvm.FunctionType.get(returnType, paramTypes, false);
//     const func = llvm.Function.Create(functionType, llvm.Function.LinkageTypes.ExternalLinkage, def.name, module);

//     const entryBB = llvm.BasicBlock.Create(context, 'main', func);
//     builder.SetInsertPoint(entryBB);

//     const str = builder.CreateGlobalStringPtr('HelloWorld', 'str', 0, module);
//     const printfFn = llvmData.module.getFunction('printf');
//     if (printfFn) {
//         llvmData.builder.CreateCall(printfFn, [str], 'qwe');
//     }

//     const namedValues = new Map<string, llvm.Argument>();
//     for (let i = 0; i < def.args.length; i++) {
//         namedValues.set(def.args[i].name, func.getArg(i));
//     }
//     const result = generateExpression(def.expr, llvmData, namedValues);
//     builder.CreateRet(result);

//     if (llvm.verifyFunction(func)) {
//         throw new Error('Error: LLVM IR generation: function generatation failed!');
//     }
// }

// function generateExpression(expr: Expression, llvmData: LLVMData, namedValues: Map<string, llvm.Argument>): llvm.Value {
//     if (isNumberLiteral(expr)) {
//         return llvmData.builder.getInt64(expr.value);
//     } else {
//         namedValues;
//     }
//     throw new Error('Error: LLVM IR generation: the case must be covered by the validator!');
// }
