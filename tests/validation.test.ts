import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MAX_AMOUNT, parseAmount, sumAmounts } from '../src/domain/ledger.ts'
import type { CategorySymbol, TransactionInput, TransactionType } from '../src/domain/types.ts'
import { assertCategoryUnused, isCategorySymbol, isTransactionType, validateCategories, validateCategory, validateCategoryName, validateLedger, validateTransaction, validateTransactionInput, validateTransactions } from '../src/domain/validateLedger.ts'
import { createInput, createLargeLedger, createLedger } from './fixtures.ts'

for (const value of ['', '0', '-1', '+1', '1.5', '1e4', 'abc', '9999999999999', 'Infinity', 'NaN', '1,,2', '1,2', '1 000', '1,000,', '₩1,000']) {
  test(`잘못된 원화 입력 ${JSON.stringify(value)}를 거부한다`, () => assert.throws(() => parseAmount(value)))
}

test('정수 금액과 올바른 천 단위 입력 및 경계 값을 허용한다', () => {
  assert.equal(parseAmount('1'), 1)
  assert.equal(parseAmount(' 1,500 '), 1500)
  assert.equal(parseAmount('001'), 1)
  assert.equal(parseAmount('999,999,999,999'), MAX_AMOUNT)
  assert.equal(parseAmount('999999999999'), MAX_AMOUNT)
  assert.equal(sumAmounts([100, 200, 1]), 301)
  assert.equal(sumAmounts([]), 0)
  for (const values of [[1.5], [-1], [NaN], [Infinity], [Number.MAX_SAFE_INTEGER, 1]]) {
    assert.throws(() => sumAmounts(values), /정수/)
  }
})

test('iOS 타입·아이콘 열거 값과 API Ledger JSON 구조가 호환된다', () => {
  assert.equal(isTransactionType('expense'), true)
  assert.equal(isTransactionType('income'), true)
  for (const invalid of ['transfer', '', null, 0]) assert.equal(isTransactionType(invalid), false)
  for (const symbol of ['food', 'coffee', 'transport', 'shopping', 'living', 'home', 'income', 'other']) {
    assert.equal(isCategorySymbol(symbol), true)
    assert.equal(validateCategory({ ...createLedger().categories[0], symbol }).symbol, symbol as CategorySymbol)
  }
  for (const invalid of ['unknown', null, 1]) assert.equal(isCategorySymbol(invalid), false)
  const snapshot: unknown = JSON.parse(JSON.stringify(createLedger()))
  assert.deepEqual(validateLedger(snapshot), createLedger())
})

for (const value of [null, undefined, [], '', 0, {}, { version: 2, transactions: [], categories: [] }, { version: 1, transactions: {}, categories: [] }, { version: 1, transactions: [], categories: {} }]) {
  test(`잘못된 Ledger 구조 ${JSON.stringify(value)}를 거부한다`, () => assert.throws(() => validateLedger(value)))
}

test('빈 Ledger도 정상 데이터이며 검증에서 원본 객체를 유지한다', () => {
  const empty = { version: 1, transactions: [], categories: [] }
  assert.equal(validateLedger(empty), empty)
  const ledger = createLedger()
  assert.equal(validateLedger(ledger), ledger)
  assert.equal(validateCategory(ledger.categories[0]), ledger.categories[0])
  assert.equal(validateTransaction(ledger.transactions[0]), ledger.transactions[0])
})

for (const [field, value] of [
  ['id', ''], ['id', 1], ['name', '   '], ['name', '가'.repeat(21)], ['name', null],
  ['type', 'transfer'], ['symbol', 'invalid'],
  ['sortOrder', undefined], ['sortOrder', null], ['sortOrder', '1'], ['sortOrder', -1],
  ['sortOrder', 1.5], ['sortOrder', Infinity], ['sortOrder', NaN], ['sortOrder', Number.MAX_SAFE_INTEGER + 1],
] as const) {
  test(`잘못된 카테고리 ${field}=${JSON.stringify(value)}를 거부한다`, () => {
    assert.throws(() => validateCategory({ ...createLedger().categories[0], [field]: value }))
  })
}

for (const [field, value] of [
  ['id', ''], ['id', 1], ['categoryId', ''], ['categoryId', null], ['type', 'transfer'],
  ['date', '2026-02-29'], ['date', '2026-1-01'], ['date', null], ['amount', 0], ['amount', -1],
  ['amount', 1.5], ['amount', '100'], ['amount', Infinity], ['amount', NaN], ['amount', MAX_AMOUNT + 1],
  ['memo', null], ['memo', '가'.repeat(101)],
] as const) {
  test(`잘못된 거래 ${field}=${String(value)}를 거부한다`, () => {
    assert.throws(() => validateTransaction({ ...createLedger().transactions[0], [field]: value }))
  })
}

test('카테고리·거래 목록의 형식과 중복 ID·동일 유형 이름 중복을 검사한다', () => {
  const { categories, transactions } = createLedger()
  for (const value of [null, {}, '', [null], [[]]]) {
    assert.throws(() => validateCategories(value))
    assert.throws(() => validateTransactions(value))
  }
  assert.throws(() => validateCategories([...categories, categories[0]]))
  assert.throws(() => validateCategories([...categories, { ...categories[1], id: 'duplicate-name', name: 'cAFE' }]), /중복/)
  assert.throws(() => validateTransactions([...transactions, transactions[0]]))
  assert.doesNotThrow(() => validateCategories([...categories, { ...categories[0], id: 'same-name-income', type: 'income', symbol: 'income' }]))
})

test('전체 Ledger에서 고아 참조와 거래·카테고리 유형 불일치를 거부한다', () => {
  for (const categoryId of ['missing', 'salary']) {
    const ledger = createLedger()
    ledger.transactions[0].categoryId = categoryId
    assert.throws(() => validateLedger(ledger))
    assert.doesNotThrow(() => validateTransaction(ledger.transactions[0]))
  }
  const ledger = createLedger()
  ledger.categories = []
  assert.throws(() => validateLedger(ledger))
})

test('개별 금액과 전체 합계의 안전한 정수 한도를 각각 검증한다', () => {
  const ledger = createLargeLedger(Number.MAX_SAFE_INTEGER)
  assert.doesNotThrow(() => validateLedger(ledger))
  ledger.transactions.at(-1)!.amount += 1
  assert.throws(() => validateTransactions(ledger.transactions), /한도/)
})

test('거래 입력은 기존 객체를 변경하지 않고 공백 메모를 정규화한다', () => {
  const ledger = createLedger()
  const input = Object.freeze(createInput())
  const before = JSON.stringify(ledger)
  const normalized = validateTransactionInput(ledger, input)
  assert.deepEqual(normalized, { ...input, memo: '식사' })
  assert.equal(input.memo, '  식사  ')
  assert.equal(JSON.stringify(ledger), before)
  assert.equal(validateTransactionInput(ledger, { ...input, memo: '   ' }).memo, '')
  assert.equal(validateTransactionInput(ledger, { ...input, memo: ` ${'가'.repeat(100)} ` }).memo.length, 100)
  assert.doesNotThrow(() => validateTransactionInput(ledger, { ...input, type: 'income', categoryId: 'salary' }, 'a'))
})

test('거래 입력의 잘못된 유형·참조·날짜·금액·메모·수정 ID를 거부한다', () => {
  const ledger = createLedger()
  const input = createInput()
  for (const change of [
    { type: 'transfer' }, { categoryId: 'missing' }, { categoryId: 'salary' }, { date: '2026-02-30' },
    { amount: 0 }, { amount: '1234' }, { amount: 1.5 }, { amount: MAX_AMOUNT + 1 }, { memo: null }, { memo: '가'.repeat(101) },
  ]) assert.throws(() => validateTransactionInput(ledger, { ...input, ...change } as TransactionInput))
  assert.throws(() => validateTransactionInput(ledger, input, 'missing'))
  assert.throws(() => validateTransactionInput(ledger, input, ''))
  assert.throws(() => validateTransactionInput(ledger, null as unknown as TransactionInput))
})

test('한도 근처의 신규 입력은 거부하고 기존 거래를 바꾸면 이전 금액을 제외한다', () => {
  const ledger = createLargeLedger(Number.MAX_SAFE_INTEGER)
  const input = { ...createInput(), amount: 1 }
  assert.throws(() => validateTransactionInput(ledger, input), /한도/)
  assert.doesNotThrow(() => validateTransactionInput(ledger, input, ledger.transactions[0].id))
})

test('카테고리 이름은 공백 제거·1~20자·유형별 중복·기존 ID 규칙을 따른다', () => {
  const ledger = createLedger()
  const before = JSON.stringify(ledger)
  assert.equal(validateCategoryName(ledger, 'expense', '  도서  '), '도서')
  assert.equal(validateCategoryName(ledger, 'expense', ' Cafe ', 'cafe'), 'Cafe')
  assert.equal(validateCategoryName(ledger, 'income', 'Cafe'), 'Cafe')
  assert.equal(validateCategoryName(ledger, 'expense', '가'.repeat(20)), '가'.repeat(20))
  for (const name of ['', '   ', '가'.repeat(21), ' 식비 ', 'cAFE']) {
    assert.throws(() => validateCategoryName(ledger, 'expense', name))
  }
  assert.throws(() => validateCategoryName(ledger, 'expense', '도서', 'missing'))
  assert.throws(() => validateCategoryName(ledger, 'income', '이름', 'food'))
  assert.throws(() => validateCategoryName(ledger, 'transfer' as TransactionType, '이름'))
  assert.throws(() => validateCategoryName(ledger, 'expense', null as unknown as string))
  assert.equal(JSON.stringify(ledger), before)
})

test('사용 중인 카테고리는 삭제 검증에서 차단하고 원본을 유지한다', () => {
  const ledger = createLedger()
  const before = JSON.stringify(ledger)
  assert.throws(() => assertCategoryUnused(ledger, 'food'), /사용 중/)
  assert.doesNotThrow(() => assertCategoryUnused(ledger, 'transport'))
  assert.equal(JSON.stringify(ledger), before)
})
