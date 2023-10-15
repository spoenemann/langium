; ModuleID = 'example/example.calc'
source_filename = "example/example.calc"
target triple = "arm64-apple-macosx14.0.0"

@float_modifier = private unnamed_addr constant [4 x i8] c"%f\0A\00", align 1

declare i32 @printf(i8*, ...)

declare double @pow(double, double, ...)

define double @succ(double %0) {
entry:
  %1 = fadd double %0, 1.000000e+00
  ret double %1
}

define double @root(double %0, double %1) {
entry:
  %2 = fdiv double 1.000000e+00, %1
  %3 = call double (double, double, ...) @pow(double %0, double %2)
  ret double %3
}

define double @sqrt(double %0) {
entry:
  %1 = call double @root(double %0, double 2.000000e+00)
  ret double %1
}

define double @add(double %0) {
entry:
  %1 = call double @succ(double %0)
  %2 = fadd double %0, %1
  ret double %2
}

define i64 @main() {
entry:
  %a = alloca double, align 8
  store double 3.000000e+00, double* %a, align 8
  %0 = load double, double* %a, align 8
  %b = alloca double, align 8
  store double 5.000000e+00, double* %b, align 8
  %1 = load double, double* %b, align 8
  %2 = fadd double %0, %1
  %c = alloca double, align 8
  store double %2, double* %c, align 8
  %3 = load double, double* %c, align 8
  %4 = call double (double, double, ...) @pow(double %0, double %1)
  %d = alloca double, align 8
  store double %4, double* %d, align 8
  %5 = load double, double* %d, align 8
  %6 = fmul double 2.000000e+00, %3
  %7 = call i32 (i8*, ...) @printf(i8* getelementptr inbounds ([4 x i8], [4 x i8]* @float_modifier, i32 0, i32 0), double %6)
  %8 = frem double %1, 2.000000e+00
  %9 = call i32 (i8*, ...) @printf(i8* getelementptr inbounds ([4 x i8], [4 x i8]* @float_modifier, i32 0, i32 0), double %8)
  %10 = call double @add(double 8.000000e+00)
  %11 = call i32 (i8*, ...) @printf(i8* getelementptr inbounds ([4 x i8], [4 x i8]* @float_modifier, i32 0, i32 0), double %10)
  %12 = call double @add(double 3.000000e+00)
  %13 = call i32 (i8*, ...) @printf(i8* getelementptr inbounds ([4 x i8], [4 x i8]* @float_modifier, i32 0, i32 0), double %12)
  %14 = call double @root(double %5, double 3.000000e+00)
  %15 = call i32 (i8*, ...) @printf(i8* getelementptr inbounds ([4 x i8], [4 x i8]* @float_modifier, i32 0, i32 0), double %14)
  %16 = call double @root(double 6.400000e+01, double 3.000000e+00)
  %17 = call i32 (i8*, ...) @printf(i8* getelementptr inbounds ([4 x i8], [4 x i8]* @float_modifier, i32 0, i32 0), double %16)
  %18 = call double @sqrt(double 8.100000e+01)
  %19 = call i32 (i8*, ...) @printf(i8* getelementptr inbounds ([4 x i8], [4 x i8]* @float_modifier, i32 0, i32 0), double %18)
  ret i64 0
}
