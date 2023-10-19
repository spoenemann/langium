import sys

def fib(n):
    if n < 2:
        return n
    else:
        return fib(n - 1) + fib(n - 2)

if __name__ == '__main__':    
    sys.exit(fib(40) % 256)
