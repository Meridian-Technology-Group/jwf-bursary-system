-- GT migration PR-C (S9): the Old Palace partnering school. Additive: no
-- existing row changes. The code that knows this value ships in the same PR,
-- and no data may use it until that code is deployed where the data lives.
ALTER TYPE "School" ADD VALUE IF NOT EXISTS 'OP_PARTNER';
