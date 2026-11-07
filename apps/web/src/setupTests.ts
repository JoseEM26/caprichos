import '@testing-library/jest-dom/vitest';

import { configure } from '@testing-library/react';

// findBy*/waitFor esperan hasta 5 s (por defecto 1 s): evita falsos fallos por lentitud de la máquina o del CI
configure({ asyncUtilTimeout: 5000 });
