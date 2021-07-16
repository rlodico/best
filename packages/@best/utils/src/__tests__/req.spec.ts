/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
*/

import path from 'path';
import { req } from '../req';

describe('req', () => {
    it('returns the default export for an es5 module', () => {
        expect(req(path.join(__dirname, 'req', 'mockEs5Module.js'))).toBe('this is the default es5 export');
    });

    it('returns the default export for an es6 module', () => {
        expect(req(path.join(__dirname, 'req', 'mockEs6Module.js'))).toBe('this is the default es6 export');
    });
});