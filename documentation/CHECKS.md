# Financial Control Checks - AI Data Collection Plan

This document outlines the specific data collection requirements for each financial control check using the Odoo MCP server.

## 1. Crediteuren met een debetsaldo (Possible Double Payments)

### **Purpose**
Identify creditors with debit balances, which may indicate double payments or missing receipts.

### **Data Collection Requirements**

#### **📋 Primary Data Collection**

##### **Creditors with Debit Balances**
- **Model**: `account.move.line`
- **Filters**:
  - `account_type = 'liability_payable'`
  - `balance < 0` (debit balance)
  - `state = 'posted'`
- **Fields**: 
  - `partner_id`
  - `balance`
  - `date`
  - `move_id`
  - `name` (description)
  - `account_id`
- **Purpose**: Find all creditors with unusual debit balances

##### **Supporting Data**
- **Partner Information**
  - **Model**: `res.partner`
  - **Filters**: Partner IDs from above query
  - **Fields**: `name`, `supplier_rank`, `is_company`, `email`, `phone`
  - **Purpose**: Get creditor details

- **Related Journal Entries**
  - **Model**: `account.move`
  - **Filters**: Move IDs from above query
  - **Fields**: `name`, `ref`, `date`, `journal_id`, `move_type`
  - **Purpose**: Understand the nature of transactions

- **Payment History**
  - **Model**: `account.payment`
  - **Filters**: 
    - `partner_id` in creditor list
    - `payment_type = 'outbound'`
  - **Fields**: `amount`, `date`, `payment_method_id`, `ref`
  - **Purpose**: Check for duplicate payments

### **AI Analysis Plan**
1. **Identify Patterns**:
   - Same amount paid multiple times
   - Payments without corresponding invoices
   - Timing patterns (same date payments)
2. **Risk Assessment**:
   - High-risk: Large amounts, recent dates
   - Medium-risk: Multiple small amounts
   - Low-risk: Old entries with explanations
3. **Recommendations**:
   - Investigate specific transactions
   - Request supporting documentation
   - Suggest reconciliation procedures

---

## 2. Leveranciersfacturen in concept (Draft Supplier Invoices)

### **Purpose**
Identify draft supplier invoices that need to be processed, including those in multiple purchase journals.

### **Data Collection Requirements**

#### **📋 Primary Data Collection**

##### **Draft Supplier Invoices**
- **Model**: `account.move`
- **Filters**:
  - `state = 'draft'`
  - `move_type = 'in_invoice'`
  - `journal_id` in purchase journals
- **Fields**:
  - `name`
  - `ref`
  - `date`
  - `partner_id`
  - `amount_total`
  - `amount_untaxed`
  - `amount_tax`
  - `journal_id`
  - `invoice_date`
  - `invoice_date_due`
- **Purpose**: Find all unprocessed supplier invoices

##### **Supporting Data**
- **Purchase Journals**
  - **Model**: `account.journal`
  - **Filters**:
    - `type = 'purchase'`
  - **Fields**: `name`, `code`, `type`
  - **Purpose**: Identify all purchase journals

- **Supplier Information**
  - **Model**: `res.partner`
  - **Filters**: Partner IDs from invoice query
  - **Fields**: `name`, `supplier_rank`, `is_company`, `payment_term_id`
  - **Purpose**: Get supplier details and payment terms

- **Invoice Lines**
  - **Model**: `account.move.line`
  - **Filters**: Move IDs from invoice query
  - **Fields**: `name`, `quantity`, `price_unit`, `price_subtotal`, `product_id`
  - **Purpose**: Detailed invoice line information

### **AI Analysis Plan**
1. **Categorize by Journal**:
   - Group invoices by purchase journal
   - Identify journals with most draft invoices
2. **Age Analysis**:
   - Calculate days since invoice date
   - Identify old draft invoices requiring attention
3. **Amount Analysis**:
   - Large amounts requiring immediate processing
   - Small amounts that might be duplicates
4. **Recommendations**:
   - Priority processing order
   - Journal-specific processing procedures
   - Supplier follow-up requirements

---

## 3. Klantfacturen in concept (Draft Customer Invoices)

### **Purpose**
Identify draft customer invoices that need to be processed in sales journals.

### **Data Collection Requirements**

#### **📋 Primary Data Collection**

##### **Draft Customer Invoices**
- **Model**: `account.move`
- **Filters**:
  - `state = 'draft'`
  - `move_type = 'out_invoice'`
  - `journal_id` in sales journals
- **Fields**:
  - `name`
  - `ref`
  - `date`
  - `partner_id`
  - `amount_total`
  - `amount_untaxed`
  - `amount_tax`
  - `journal_id`
  - `invoice_date`
  - `invoice_date_due`
- **Purpose**: Find all unprocessed customer invoices

##### **Supporting Data**
- **Sales Journals**
  - **Model**: `account.journal`
  - **Filters**:
    - `type = 'sale'`
  - **Fields**: `name`, `code`, `type`
  - **Purpose**: Identify all sales journals

- **Customer Information**
  - **Model**: `res.partner`
  - **Filters**: Partner IDs from invoice query
  - **Fields**: `name`, `customer_rank`, `is_company`, `payment_term_id`
  - **Purpose**: Get customer details and payment terms

- **Related Sales Orders**
  - **Model**: `sale.order`
  - **Filters**: Partner IDs from invoice query
  - **Fields**: `name`, `state`, `amount_total`, `date_order`
  - **Purpose**: Check for related sales orders

### **AI Analysis Plan**
1. **Revenue Impact**:
   - Calculate total revenue in draft invoices
   - Identify high-value invoices requiring immediate processing
2. **Customer Analysis**:
   - Group by customer to identify patterns
   - Check for customers with multiple draft invoices
3. **Timing Analysis**:
   - Invoices approaching due dates
   - Old draft invoices requiring attention
4. **Recommendations**:
   - Priority processing based on amount and customer
   - Follow-up procedures for delayed invoices

---

## 4. Onafgeletterde bank transacties (Unreconciled Bank Transactions)

### **Purpose**
Identify bank transactions that need to be allocated to invoices, receipts, or other documents.

### **Data Collection Requirements**

#### **📋 Primary Data Collection**

##### **Unreconciled Bank Statement Lines**
- **Model**: `account.bank.statement.line`
- **Filters**:
  - `is_reconciled = false`
  - `amount != 0`
- **Fields**:
  - `name`
  - `amount`
  - `date`
  - `partner_id`
  - `ref`
  - `statement_id`
  - `account_number`
- **Purpose**: Find all unreconciled bank transactions

##### **Supporting Data**
- **Bank Statements**
  - **Model**: `account.bank.statement`
  - **Filters**: Statement IDs from above query
  - **Fields**: `name`, `date`, `balance_start`, `balance_end`, `journal_id`
  - **Purpose**: Get statement context

- **Bank Accounts**
  - **Model**: `account.account`
  - **Filters**: Account IDs from statements
  - **Fields**: `name`, `code`, `account_type`
  - **Purpose**: Identify bank accounts

- **Potential Matches**
  - **Model**: `account.move.line`
  - **Filters**:
    - `reconciled = false`
    - `account_type in ['asset_receivable', 'liability_payable']`
  - **Fields**: `partner_id`, `balance`, `date`, `name`, `move_id`
  - **Purpose**: Find potential reconciliation matches

### **AI Analysis Plan**
1. **Amount Analysis**:
   - Group by amount to find potential matches
   - Identify large unreconciled amounts
2. **Date Analysis**:
   - Find transactions close in date
   - Identify old unreconciled items
3. **Partner Matching**:
   - Match by partner name
   - Identify transactions with same partner
4. **Recommendations**:
   - Suggested reconciliation matches
   - Items requiring manual review
   - Follow-up procedures for unmatched items

---

## 5. Indicatie van dubbel geboekte facturen (Duplicate Invoice Detection)

### **Purpose**
Identify potentially duplicate invoices based on partner name, amount, invoice number, and/or date.

### **Data Collection Requirements**

#### **📋 Primary Data Collection**

##### **All Posted Invoices**
- **Model**: `account.move`
- **Filters**:
  - `state = 'posted'`
  - `move_type in ['out_invoice', 'in_invoice']`
- **Fields**:
  - `name`
  - `ref`
  - `date`
  - `invoice_date`
  - `partner_id`
  - `amount_total`
  - `amount_untaxed`
  - `amount_tax`
  - `move_type`
  - `journal_id`
- **Purpose**: Get all processed invoices for duplicate detection

##### **Supporting Data**
- **Partner Information**
  - **Model**: `res.partner`
  - **Filters**: All partner IDs from invoice query
  - **Fields**: `name`, `is_company`, `supplier_rank`, `customer_rank`
  - **Purpose**: Get partner details for matching

- **Invoice Lines**
  - **Model**: `account.move.line`
  - **Filters**: Move IDs from invoice query
  - **Fields**: `name`, `quantity`, `price_unit`, `product_id`
  - **Purpose**: Detailed line information for comparison

### **AI Analysis Plan**
1. **Duplicate Detection Algorithms**:
   - **Exact Match**: Same partner, amount, invoice number, date
   - **Fuzzy Match**: Same partner, similar amount (±1%), same date
   - **Pattern Match**: Same partner, same amount, different dates
   - **Reference Match**: Same invoice reference number

2. **Risk Scoring**:
   - **High Risk**: Exact matches on all criteria
   - **Medium Risk**: Matches on 3 out of 4 criteria
   - **Low Risk**: Matches on 2 out of 4 criteria

3. **Analysis Categories**:
   - **Same Day Duplicates**: Invoices posted on same date
   - **Same Amount Duplicates**: Identical amounts to same partner
   - **Same Reference Duplicates**: Same invoice reference numbers
   - **Sequential Duplicates**: Consecutive invoice numbers

4. **Recommendations**:
   - **Immediate Review**: High-risk duplicates
   - **Investigation Required**: Medium-risk items
   - **Monitoring**: Low-risk patterns
   - **Process Improvements**: Prevent future duplicates


