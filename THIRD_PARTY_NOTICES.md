# Third-party notices

Leimuovo uses the following third-party software in the browser and desktop
applications. The listed projects remain the property of their respective
copyright holders. This file is informational and does not change their
license terms.

## Tesseract.js

- Components: `tesseract.js` 7.0.0, the vendored browser worker, and
  `tesseract.js-core` 6.1.2 WebAssembly assets
- Upstream: <https://github.com/naptha/tesseract.js> and
  <https://github.com/naptha/tesseract.js-core>
- License: Apache License 2.0
- Distributed assets: `apps/web/public/vendor/tesseract/worker` and
  `apps/web/public/vendor/tesseract/core`

A complete copy of the Apache License 2.0 is distributed with the OCR core at
`apps/web/public/vendor/tesseract/core/LICENSE` and is therefore also present
in the deployed static site.

## Tesseract language data

- Components: simplified Chinese and English `4.0.0_best_int` trained data
- Upstream: <https://github.com/naptha/tessdata>
- License declared by the `@tesseract.js-data` packages: MIT
- Distributed assets: `apps/web/public/vendor/tesseract/lang`

MIT License

Copyright (c) Tesseract.js data contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## SheetJS Community Edition

- Component: `xlsx` 0.18.5
- Upstream: <https://github.com/SheetJS/sheetjs>
- License: Apache License 2.0
- Used for: generating `.xlsx` workbooks locally

The Apache License 2.0 text referenced above applies.

## Lucide

- Components: `lucide` 1.28.0 and `@lucide/astro` 1.28.0
- Upstream: <https://github.com/lucide-icons/lucide>
- License: ISC
- Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.

Some Lucide icons are derived from the Feather project and retain the notices
included in Lucide's upstream `LICENSE` file.
