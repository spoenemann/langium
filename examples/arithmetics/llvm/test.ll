; ModuleID = 'test'
source_filename = "test"
target triple = "arm64-apple-macosx14.0.0"

define i32 @main() {
  ret i32 23
}

define i32 @a() {
  ret i32 42
}
