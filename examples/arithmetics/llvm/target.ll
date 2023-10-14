; ModuleID = 'example/example.calc'
source_filename = "example/example.calc"
target triple = "arm64-apple-macosx14.0.0"

define i32 @main() #0 {
  %1 = alloca double, align 8 ; a
  %2 = alloca double, align 8 ; b
  %3 = alloca double, align 8 ; c
  store double 5.000000e+00, ptr %1, align 8
  store double 3.000000e+00, ptr %1, align 8
  store i32 2, ptr %3, align 4
  %4 = load i32, ptr %3, align 4
  ret i32 %4
  ret i32 0
}

def a: 5;
def b: 3;
// def c: a + b; // 8
// def d: (a ^ b); // 164

//def root(x, y):
//    x^(1/y);

//def sqrt(x):
//    root(x, 2);

// 2 * c; // 16
// b % 2; // 1

// This language is case-insensitive regarding symbol names
// Root(D, 3); // 32
// Root(64, 3); // 4
// Sqrt(81); // 9