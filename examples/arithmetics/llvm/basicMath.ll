; ModuleID = 'example/example.calc'
source_filename = "example/example.calc"
target triple = "arm64-apple-macosx14.0.0"

@str = private unnamed_addr constant [11 x i8] c"HelloWorld\00", align 1
@str.1 = private unnamed_addr constant [11 x i8] c"HelloWorld\00", align 1

declare i32 @printf(i8*, ...)

define i64 @main() {
  %qwe = call i32 (i8*, ...) @printf(i8* getelementptr inbounds ([11 x i8], [11 x i8]* @str, i32 0, i32 0))
  ret i64 5
}
