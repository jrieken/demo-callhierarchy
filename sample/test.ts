
class FooBarBang {
    foo(a = false): readonly string[] {
        console.log();
        if (a) {


            return this.foo();
        }
        return [];
    }
    bar() {
        if (true) this.foo(); this.bang(); this.foo();
    }
    bang() {

        let a = new FooBarBang().foo();

        let int = a.map(a => a).filter(a => {
            return true;
        }).reduce((prev, current) => {
            if (a.indexOf(prev as any)) {
                return 17;
            }
        }, 12);

        int **= 3;
        console.trace(int);

        if (int) {
            console.log('yes');
        }

        new FooBarBang().foo();
    }
}

function aGlobalFunction() {
    for (; ;) {
        new FooBarBang().bang
    }
}

function foo42(b = 6) {
    let a = b + 1;
    if (a > 234) {
        return function fib(n) {
            new FooBarBang().bar();
        }
    }
}

class CallWithSpecialNames {
    ['new\
line']() {
        aGlobalFunction();
        aGlobalFunction();
    }

    ε() {
        aGlobalFunction();
    }
}
