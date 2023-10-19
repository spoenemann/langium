; ModuleID = 'example/fibonacci.calc'
source_filename = "example/fibonacci.calc"
target triple = "arm64-apple-macosx14.0.0"

@float_modifier = private unnamed_addr constant [4 x i8] c"%f\0A\00", align 1

declare i32 @printf(i8*, ...)

declare double @pow(double, double, ...)

define double @fib(double %0) {
entry:
  %1 = fcmp olt double %0, 2.000000e+00
  br i1 %1, label %then, label %else

then:                                             ; preds = %entry
  br label %ifcont

else:                                             ; preds = %entry
  %2 = fsub double %0, 1.000000e+00
  %3 = call double @fib(double %2)
  %4 = fsub double %0, 2.000000e+00
  %5 = call double @fib(double %4)
  %6 = fadd double %3, %5
  br label %ifcont

ifcont:                                           ; preds = %else, %then
  %iftmp = phi double [ %0, %then ], [ %6, %else ]
  ret double %iftmp
}

define i64 @main() {
entry:
  %0 = call double @fib(double 4.000000e+01)
  %1 = frem double %0, 2.560000e+02
  %2 = fptosi double %1 to i64
  ret i64 %2
}
