/* eslint-disable header/header */
import * as langium from 'langium';

function isLowerCase(s: string): boolean {
    return s === s.toLowerCase() && s !== s.toUpperCase();
}

const entries = Array.from(Object.entries(langium));
entries.sort((a, b) => a[0].localeCompare(b[0]));
console.log(`Total: ${entries.length}` + '\n');

const types = ['undefined', 'object', 'function', 'boolean', 'number', 'string', 'symbol', 'bigint'];
for (const type of types) {
    const symbols = entries.filter(entry => typeof entry[1] === type).map(entry => entry[0]);
    if (symbols.length > 0) {
        if (type === 'function') {
            const classes = symbols.filter(s => !isLowerCase(s.charAt(0)));
            console.log(`# CLASS (${classes.length})`);
            console.log(classes.join('\n') + '\n');
            const functions = symbols.filter(s => isLowerCase(s.charAt(0)));
            console.log(`# FUNCTION (${functions.length})`);
            console.log(functions.join('\n') + '\n');
        } else {
            console.log(`# ${type.toUpperCase()} (${symbols.length})`);
            console.log(symbols.join('\n') + '\n');
        }
    }
}

