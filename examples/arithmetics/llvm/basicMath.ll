; ModuleID = 'example/example.calc'
source_filename = "example/example.calc"
target triple = "arm64-apple-macosx14.0.0"

@float_modifier = private unnamed_addr constant [4 x i8] c"%f\0A\00", align 1

declare i32 @printf(i8*, ...)

define i64 @main() {
entry:
  %a = alloca double, align 8
  store double 5.000000e+00, double* %a, align 8
  %b = alloca double, align 8
  store double 3.000000e+00, double* %b, align 8
  %0 = call i32 (i8*, ...) @printf(i8* getelementptr inbounds ([4 x i8], [4 x i8]* @float_modifier, i32 0, i32 0), double 4.220000e+01)
  %b1 = load double, double* %b, align 8
  %a2 = load double, double* %a, align 8
  %sum_b_a = fadd double %b1, %a2
  %1 = call i32 (i8*, ...) @printf(i8* getelementptr inbounds ([4 x i8], [4 x i8]* @float_modifier, i32 0, i32 0), double %sum_b_a)
  ret i64 0
}
