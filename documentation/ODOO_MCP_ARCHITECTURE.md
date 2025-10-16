# Odoo MCP Integration - Complete Architecture

## 🏗️ System Overview

The Odoo MCP (Model Context Protocol) integration provides a comprehensive bridge between AI agents and Odoo ERP systems, enabling intelligent financial analysis and automated data processing.

## 📊 Architecture Diagram

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend       │    │   Odoo ERP      │
│   (React)       │    │   (Node.js)      │    │   (XML-RPC)     │
├─────────────────┤    ├──────────────────┤    ├─────────────────┤
│ • Checks.jsx    │◄──►│ • server.js      │◄──►│ • res.partner   │
│ • MCPIntegration│    │ • odooMcpService │    │ • account.move  │
│ • odooAiAgent   │    │ • API Routes     │    │ • account.move. │
│ • odooTools     │    │                  │    │   line          │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   OpenAI API    │    │   MCP Protocol   │    │   Dummy Data    │
│   (GPT-4o)      │    │   (Tools)        │    │   (Scripts)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🔧 Core Components

### 1. **Frontend Layer (React)**

#### **Checks.jsx**
- **Purpose**: Main UI component for managing financial checks
- **Features**:
  - Check creation, editing, and deletion
  - Description management with auto-expanding textarea
  - Play button for triggering AI analysis
  - Checkbox toggle for completion status
- **Key Functions**:
  - `handleRunAnalysis()`: Triggers AI analysis
  - `handleToggleCheck()`: Toggles check completion
  - `getTextareaRows()`: Dynamic textarea sizing

#### **MCPIntegration.jsx**
- **Purpose**: Handles AI analysis integration
- **Features**:
  - Manages AI agent initialization
  - Processes analysis results
  - Provides analysis function to parent components
- **Key Functions**:
  - `analyzeCheck()`: Executes AI analysis
  - `setAiAgent()`: Initializes AI agent
  - `onRunAnalysis()`: Passes analysis function to parent

#### **odooAiAgent.js**
- **Purpose**: AI-powered Odoo data analysis
- **Features**:
  - OpenAI GPT-4o integration
  - Tool-based analysis workflow
  - Intelligent query planning and execution
- **Key Functions**:
  - `analyzeOdooData()`: Main analysis orchestrator
  - `executeOdooTool()`: Executes specific AI tools
  - `executeOdooQuery()`: Runs Odoo queries via backend

#### **odooTools.js**
- **Purpose**: Defines AI tools for Odoo analysis
- **Tools Available**:
  - `plan_odoo_check`: Plans required queries
  - `execute_odoo_queries`: Executes planned queries
  - `analyze_results`: Analyzes query results

### 2. **Backend Layer (Node.js)**

#### **server.js**
- **Purpose**: Main API server
- **Features**:
  - Express.js REST API
  - CORS configuration
  - Google Sheets integration
  - Odoo MCP service initialization
- **Key Endpoints**:
  - `GET /health`: Health check
  - `POST /api/odoo/execute`: Execute Odoo queries
  - `GET /api/sheets/*`: Google Sheets operations

#### **odooMcpService.js**
- **Purpose**: Odoo XML-RPC integration service
- **Features**:
  - XML-RPC client implementation
  - Authentication management
  - Query execution and result processing
  - Error handling and logging
- **Key Functions**:
  - `initialize()`: Establishes Odoo connection
  - `authenticate()`: Handles authentication
  - `xmlRpcCall()`: Makes XML-RPC requests
  - `executeQueries()`: Processes query batches

### 3. **Odoo ERP Layer**

#### **Available Models**
- **res.partner**: Customers, suppliers, contacts
- **account.move**: Journal entries, invoices
- **account.move.line**: Individual accounting lines
- **account.account**: Chart of accounts
- **account.bank.statement.line**: Bank transactions
- **product.product**: Products and services
- **sale.order**: Sales orders
- **purchase.order**: Purchase orders
- **account.asset**: Fixed assets

#### **Common Filters**
- **account_type**: 'liability_payable', 'asset_receivable', 'income', 'expense'
- **move_type**: 'out_invoice', 'in_invoice', 'entry'
- **state**: 'draft', 'posted', 'cancel'
- **balance**: Use < 0 for debit balances, > 0 for credit balances

## 🛠️ Complete MCP Protocol Tools & Functions

### **AI Agent Tools (Custom Implementation)**

#### **1. plan_odoo_check**
- **Purpose**: Plans what Odoo data is needed for analysis
- **Parameters**:
  - `description` (string): Check description to analyze
  - `analysis_plan` (array): List of required queries
- **Returns**: Structured query plan

#### **2. execute_odoo_queries**
- **Purpose**: Executes planned Odoo queries
- **Parameters**:
  - `queries` (array): Array of queries to execute
- **Returns**: Query results with data and metadata

#### **3. analyze_results**
- **Purpose**: Analyzes query results and provides insights
- **Parameters**:
  - `description` (string): Original check description
  - `results` (array): Query results to analyze
- **Returns**: Final analysis and recommendations

### **MCP Protocol Tools (Official odoo-mcp Package)**

#### **1. search_records**
- **Purpose**: Search for records in any Odoo model
- **Parameters**:
  - `model` (string): The model name (e.g., 'res.partner')
  - `domain` (array): Search domain (e.g., [['is_company', '=', true]])
  - `fields` (optional array): Optional fields to fetch
  - `limit` (optional number): Maximum number of records to return
- **Returns**: Matching records with requested fields
- **Example**:
  ```json
  {
    "model": "res.partner",
    "domain": [["is_company", "=", true]],
    "fields": ["name", "email", "phone"],
    "limit": 10
  }
  ```

#### **2. read_record**
- **Purpose**: Read details of a specific record
- **Parameters**:
  - `model` (string): The model name (e.g., 'res.partner')
  - `id` (number): The record ID
  - `fields` (optional array): Optional fields to fetch
- **Returns**: Record data with requested fields
- **Example**:
  ```json
  {
    "model": "res.partner",
    "id": 1,
    "fields": ["name", "email", "phone", "is_company"]
  }
  ```

#### **3. create_record**
- **Purpose**: Create a new record in Odoo
- **Parameters**:
  - `model` (string): The model name (e.g., 'res.partner')
  - `values` (object): Dictionary of field values
- **Returns**: Dictionary with the new record ID
- **Example**:
  ```json
  {
    "model": "res.partner",
    "values": {
      "name": "New Company",
      "is_company": true,
      "email": "contact@newcompany.com"
    }
  }
  ```

#### **4. update_record**
- **Purpose**: Update an existing record
- **Parameters**:
  - `model` (string): The model name (e.g., 'res.partner')
  - `id` (number): The record ID
  - `values` (object): Dictionary of field values to update
- **Returns**: Dictionary indicating success
- **Example**:
  ```json
  {
    "model": "res.partner",
    "id": 1,
    "values": {
      "email": "newemail@company.com",
      "phone": "+1234567890"
    }
  }
  ```

#### **5. delete_record**
- **Purpose**: Delete a record from Odoo
- **Parameters**:
  - `model` (string): The model name (e.g., 'res.partner')
  - `id` (number): The record ID
- **Returns**: Dictionary indicating success
- **Example**:
  ```json
  {
    "model": "res.partner",
    "id": 1
  }
  ```

#### **6. execute_method**
- **Purpose**: Execute a custom method on an Odoo model
- **Parameters**:
  - `model` (string): The model name (e.g., 'res.partner')
  - `method` (string): Method name to execute
  - `args` (optional array): Positional arguments
  - `kwargs` (optional object): Keyword arguments
- **Returns**: Dictionary with the method result
- **Example**:
  ```json
  {
    "model": "res.partner",
    "method": "search_read",
    "args": [[["is_company", "=", true]], ["name", "email"]],
    "kwargs": {"limit": 10}
  }
  ```

#### **7. get_model_fields**
- **Purpose**: Get field definitions for a model
- **Parameters**:
  - `model` (string): The model name (e.g., 'res.partner')
- **Returns**: Dictionary with field definitions
- **Example**:
  ```json
  {
    "model": "res.partner"
  }
  ```

#### **8. search_employee** (Legacy)
- **Purpose**: Search for employees by name
- **Parameters**:
  - `name` (string): Name or part of name to search
  - `limit` (number): Maximum results (default 20)

#### **9. search_holidays** (Legacy)
- **Purpose**: Search for holidays within date range
- **Parameters**:
  - `start_date` (string): Start date in YYYY-MM-DD format
  - `end_date` (string): End date in YYYY-MM-DD format
  - `employee_id` (number): Optional employee ID filter

## 📋 System Prompts & Instructions

### **ODOO_ANALYSIS_PROMPT**
```
You are an expert Odoo financial analyst. Your role is to understand check descriptions and plan the necessary Odoo queries to answer them.

## WORKFLOW:
1. **PLAN**: Use 'plan_odoo_check' to understand what data is needed
2. **EXECUTE**: Use 'execute_odoo_queries' to get the data from Odoo
3. **ANALYZE**: Use 'analyze_results' to provide the final answer

## COMMON ODOO TABLES:
- **res.partner**: Partners (customers/suppliers)
- **account.move**: Journal entries and invoices
- **account.move.line**: Individual accounting lines
- **account.account**: Chart of accounts
- **account.bank.statement.line**: Bank transactions

## COMMON FILTERS:
- **account_type**: 'liability_payable', 'asset_receivable', 'income', 'expense'
- **move_type**: 'out_invoice', 'in_invoice', 'entry'
- **state**: 'draft', 'posted', 'cancel'
- **balance**: Use < 0 for debit balances, > 0 for credit balances

Always start with 'plan_odoo_check' to understand what's needed.
```

## 🔄 Data Flow

### **1. User Interaction Flow**
```
User Input → Checks.jsx → MCPIntegration.jsx → odooAiAgent.js → Backend API → Odoo ERP
```

### **2. AI Analysis Flow**
```
Description → plan_odoo_check → execute_odoo_queries → analyze_results → Final Analysis
```

### **3. Query Execution Flow**
```
AI Tool Call → Backend API → odooMcpService → XML-RPC → Odoo Database → Results
```

## 📊 Complete MCP Resources & URI Patterns

### **MCP Resources (Official odoo-mcp Package)**

#### **1. odoo://models**
- **Purpose**: Lists all available models in the Odoo system
- **Description**: Returns a JSON array of model information including model names, descriptions, and metadata
- **Returns**: JSON array of model information
- **Example Usage**: `odoo://models`
- **Sample Response**:
  ```json
  [
    {
      "name": "res.partner",
      "description": "Contact",
      "type": "model"
    },
    {
      "name": "account.move",
      "description": "Journal Entry",
      "type": "model"
    }
  ]
  ```

#### **2. odoo://model/{model_name}**
- **Purpose**: Get detailed information about a specific model including fields
- **Description**: Returns comprehensive model metadata including field definitions, constraints, and relationships
- **Parameters**:
  - `model_name`: Name of the Odoo model (e.g., 'res.partner')
- **Returns**: JSON object with model metadata and field definitions
- **Example Usage**: `odoo://model/res.partner`
- **Sample Response**:
  ```json
  {
    "name": "res.partner",
    "description": "Contact",
    "fields": {
      "name": {
        "type": "char",
        "string": "Name",
        "required": true
      },
      "email": {
        "type": "char",
        "string": "Email"
      },
      "is_company": {
        "type": "boolean",
        "string": "Is a Company"
      }
    }
  }
  ```

#### **3. odoo://record/{model_name}/{record_id}**
- **Purpose**: Get detailed information of a specific record by ID
- **Description**: Retrieves complete record data including all field values and relationships
- **Parameters**:
  - `model_name`: Name of the Odoo model (e.g., 'res.partner')
  - `record_id`: ID of the record
- **Returns**: JSON object with record data
- **Example Usage**: `odoo://record/res.partner/1`
- **Sample Response**:
  ```json
  {
    "id": 1,
    "name": "Acme Corporation",
    "email": "contact@acme.com",
    "is_company": true,
    "phone": "+1234567890"
  }
  ```

#### **4. odoo://search/{model_name}/{domain}**
- **Purpose**: Search for records matching the domain
- **Description**: Performs a search operation and returns matching records with a default limit of 10
- **Parameters**:
  - `model_name`: Name of the Odoo model (e.g., 'res.partner')
  - `domain`: Search domain in JSON format (e.g., '[["name", "ilike", "test"]]')
- **Returns**: JSON array of matching records
- **Example Usage**: `odoo://search/res.partner/[["is_company","=",true]]`
- **Sample Response**:
  ```json
  [
    {
      "id": 1,
      "name": "Acme Corporation",
      "email": "contact@acme.com",
      "is_company": true
    },
    {
      "id": 2,
      "name": "Tech Solutions Ltd",
      "email": "info@techsolutions.com",
      "is_company": true
    }
  ]
  ```

### **Domain Formatting Guidelines**

#### **Supported Domain Formats**

##### **1. List Format (Recommended)**
```json
[["field", "operator", value], ...]
```

##### **2. Object Format**
```json
{
  "conditions": [
    {
      "field": "field_name",
      "operator": "operator",
      "value": "value"
    }
  ]
}
```

##### **3. JSON String Format**
```json
"[{\"field\": \"name\", \"operator\": \"ilike\", \"value\": \"test\"}]"
```

#### **Common Operators**
- **`=`**: Equal to
- **`!=`**: Not equal to
- **`>`**: Greater than
- **`<`**: Less than
- **`>=`**: Greater than or equal to
- **`<=`**: Less than or equal to
- **`in`**: Value is in list
- **`not in`**: Value is not in list
- **`like`**: Pattern matching (case-sensitive)
- **`ilike`**: Pattern matching (case-insensitive)
- **`=like`**: Pattern matching with wildcards
- **`=ilike`**: Case-insensitive pattern matching with wildcards

#### **Domain Examples**

##### **Simple Conditions**
```json
// Find companies
[["is_company", "=", true]]

// Find records with specific name
[["name", "ilike", "acme"]]

// Find records created after date
[["create_date", ">=", "2024-01-01"]]
```

##### **Multiple Conditions (AND)**
```json
// Find companies created this year
[
  ["is_company", "=", true],
  ["create_date", ">=", "2024-01-01"]
]
```

##### **Complex Conditions with OR**
```json
// Find companies OR records with specific email
[
  "|",
  ["is_company", "=", true],
  ["email", "ilike", "admin"]
]
```

##### **Nested Conditions**
```json
// Find companies created this year OR records with admin email
[
  "|",
  [
    "&",
    ["is_company", "=", true],
    ["create_date", ">=", "2024-01-01"]
  ],
  ["email", "ilike", "admin"]
]
```

### **Field Selection**

#### **Available Fields by Model**

##### **res.partner (Partners)**
- `name`: Partner name
- `email`: Email address
- `phone`: Phone number
- `mobile`: Mobile number
- `is_company`: Is a company
- `parent_id`: Parent company
- `category_id`: Tags
- `street`: Street address
- `city`: City
- `zip`: Postal code
- `country_id`: Country
- `state_id`: State/Province
- `website`: Website
- `vat`: Tax ID
- `create_date`: Creation date
- `write_date`: Last modification date

##### **account.move (Journal Entries)**
- `name`: Entry number
- `date`: Entry date
- `ref`: Reference
- `journal_id`: Journal
- `move_type`: Entry type
- `state`: State (draft, posted, cancel)
- `amount_total`: Total amount
- `partner_id`: Partner
- `line_ids`: Accounting lines
- `create_date`: Creation date
- `write_date`: Last modification date

##### **account.move.line (Accounting Lines)**
- `name`: Description
- `account_id`: Account
- `partner_id`: Partner
- `debit`: Debit amount
- `credit`: Credit amount
- `balance`: Balance (debit - credit)
- `move_id`: Journal entry
- `date`: Date
- `create_date`: Creation date
- `write_date`: Last modification date

##### **account.account (Chart of Accounts)**
- `name`: Account name
- `code`: Account code
- `account_type`: Account type
- `user_type_id`: User type
- `reconcile`: Allow reconciliation
- `deprecated`: Deprecated account
- `create_date`: Creation date
- `write_date`: Last modification date

## 📊 Data Collection & Update Capabilities

### **What Data Can Be Collected**

#### **Financial Data**
- **Partners**: Customers, suppliers, contacts with complete contact information
- **Journal Entries**: All accounting transactions with line details
- **Chart of Accounts**: Complete account structure and classifications
- **Bank Statements**: Bank transactions and reconciliation data
- **Invoices**: Customer and supplier invoices with payment status
- **Payments**: Payment records and bank transfers
- **Assets**: Fixed assets with depreciation schedules
- **Products**: Product catalog with pricing and inventory
- **Sales Orders**: Customer orders and fulfillment status
- **Purchase Orders**: Supplier orders and receipt status

#### **Operational Data**
- **Employees**: Staff information and organizational structure
- **Projects**: Project management and time tracking
- **Tasks**: Task assignments and completion status
- **Leads**: Sales leads and opportunity tracking
- **Contracts**: Customer and supplier agreements
- **Inventory**: Stock levels and warehouse management
- **Manufacturing**: Production orders and work centers
- **Quality**: Quality control and inspection records

#### **System Data**
- **Users**: System users and access permissions
- **Groups**: Security groups and role assignments
- **Companies**: Multi-company configurations
- **Currencies**: Exchange rates and currency settings
- **Fiscal Years**: Accounting periods and fiscal calendars
- **Journals**: Accounting journals and configurations

### **What Data Can Be Updated**

#### **Create Operations**
- **New Partners**: Add customers, suppliers, or contacts
- **Journal Entries**: Create accounting transactions
- **Invoices**: Generate customer or supplier invoices
- **Products**: Add new products or services
- **Sales Orders**: Create customer orders
- **Purchase Orders**: Create supplier orders
- **Assets**: Register new fixed assets
- **Projects**: Create new projects
- **Tasks**: Assign new tasks
- **Leads**: Create sales opportunities

#### **Update Operations**
- **Partner Information**: Modify contact details, addresses, payment terms
- **Invoice Status**: Update payment status, add payments
- **Product Data**: Update prices, descriptions, inventory levels
- **Order Status**: Change order states, add line items
- **Asset Information**: Update asset details, depreciation
- **Project Progress**: Update project status, time entries
- **Task Status**: Mark tasks complete, reassign tasks
- **Lead Information**: Update opportunity details, stage progression

#### **Delete Operations**
- **Draft Records**: Remove draft invoices, orders, entries
- **Cancelled Items**: Delete cancelled transactions
- **Obsolete Data**: Remove outdated partners, products
- **Test Records**: Clean up test or dummy data

### **Data Access Patterns**

#### **Read-Only Operations**
- **Reporting**: Generate financial reports and analytics
- **Auditing**: Review transaction history and changes
- **Compliance**: Extract data for regulatory reporting
- **Analysis**: Perform data analysis and insights

#### **Read-Write Operations**
- **Data Entry**: Create and modify business transactions
- **Process Management**: Update workflow states and approvals
- **Configuration**: Modify system settings and parameters
- **Maintenance**: Update master data and references

### **Security & Permissions**

#### **Access Control**
- **User Permissions**: Role-based access to specific models
- **Field-Level Security**: Restrict access to sensitive fields
- **Record Rules**: Filter data based on user context
- **Company Rules**: Multi-company data isolation

#### **Audit Trail**
- **Change Tracking**: Log all create, update, delete operations
- **User Attribution**: Track who made changes and when
- **Field History**: Maintain history of field value changes
- **Access Logs**: Monitor system access and usage

### **Data Validation & Constraints**

#### **Business Rules**
- **Required Fields**: Enforce mandatory data entry
- **Data Types**: Validate field formats and ranges
- **Referential Integrity**: Ensure foreign key relationships
- **Business Logic**: Apply custom validation rules

#### **Data Quality**
- **Duplicate Detection**: Identify and prevent duplicate records
- **Data Consistency**: Ensure data coherence across modules
- **Format Validation**: Validate email, phone, date formats
- **Range Checks**: Enforce numeric and date ranges

## 🗂️ Dummy Data & Testing

### **Available Scripts**
- **dummy_ingest.py**: Comprehensive data seeding
- **add_creditor_debitsaldo.py**: Creditor debit balance data
- **Fixed_Assets_Template.xlsx**: Asset import template

### **Generated Data Types**
- Partners (customers, suppliers)
- Products and services
- Invoices (customer/supplier)
- Sales and purchase orders
- Journal entries
- Fixed assets
- Bank transactions

## 🔒 Security & Configuration

### **Environment Variables**
```bash
ODOO_URL=https://your-odoo-instance.com
ODOO_DB=your-database-name
ODOO_USERNAME=your-username
ODOO_PASSWORD=your-password-or-api-key
ODOO_API_KEY=your-api-key
ODOO_TIMEOUT=30
ODOO_VERIFY_SSL=true
```

### **Security Features**
- SSL verification enabled by default
- API key authentication support
- Environment variable configuration
- Credential protection in .gitignore

## 🚀 Deployment Options

### **1. Direct Python Integration**
```python
from odoo_mcp.server import OdooMCPServer
server = OdooMCPServer()
result = server.execute_method(model="res.partner", method="search", args=[[["is_company", "=", True]]])
```

### **2. Claude Desktop Integration**
```json
{
  "mcpServers": {
    "odoo": {
      "command": "python3",
      "args": ["-m", "odoo_mcp"],
      "env": {
        "ODOO_URL": "https://your-odoo-instance.com",
        "ODOO_DB": "your-database-name",
        "ODOO_USERNAME": "your-username",
        "ODOO_PASSWORD": "your-password-or-api-key"
      }
    }
  }
}
```

### **3. Docker Integration**
```json
{
  "mcpServers": {
    "odoo": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "ODOO_URL", "-e", "ODOO_DB", "-e", "ODOO_USERNAME", "-e", "ODOO_PASSWORD", "mcp/odoo"]
    }
  }
}
```

## 📈 Performance & Optimization

### **Query Optimization**
- Batch query execution
- Intelligent caching
- Result pagination
- Error handling and retry logic

### **AI Agent Optimization**
- Tool call batching
- Context management
- Response streaming
- Cost optimization

## 🔍 Monitoring & Debugging

### **Logging Levels**
- **Info**: General operations
- **Debug**: Detailed execution flow
- **Error**: Error conditions and stack traces
- **Warn**: Warning conditions

### **Debug Mode**
```bash
export ODOO_DEBUG=true
```

## 📚 Next Steps & Extensions

### **Planned Features**
- Real-time data synchronization
- Advanced analytics dashboard
- Custom report generation
- Multi-tenant support
- API rate limiting
- Advanced caching strategies

### **Integration Possibilities**
- Google Sheets synchronization
- Slack/Teams notifications
- Email reporting
- Mobile app integration
- Third-party ERP connections

## 📋 Complete Odoo Tables & API Index

### **Core Odoo Models (Standard Installation)**

#### **📊 Accounting & Finance**
- **`account.account`**: Chart of accounts
- **`account.move`**: Journal entries and invoices
- **`account.move.line`**: Individual accounting lines
- **`account.journal`**: Accounting journals
- **`account.payment`**: Payment records
- **`account.bank.statement`**: Bank statements
- **`account.bank.statement.line`**: Bank statement lines
- **`account.reconcile.model`**: Reconciliation models
- **`account.analytic.account`**: Analytic accounts
- **`account.analytic.line`**: Analytic lines
- **`account.asset`**: Fixed assets
- **`account.asset.category`**: Asset categories
- **`account.tax`**: Tax definitions
- **`account.fiscal.position`**: Fiscal positions
- **`account.fiscal.year`**: Fiscal years
- **`account.period`**: Accounting periods

#### **👥 Partners & Contacts**
- **`res.partner`**: Partners (customers, suppliers, contacts)
- **`res.partner.category`**: Partner categories/tags
- **`res.partner.bank`**: Partner bank accounts
- **`res.users`**: System users
- **`res.groups`**: User groups
- **`res.company`**: Companies
- **`res.country`**: Countries
- **`res.country.state`**: States/Provinces
- **`res.currency`**: Currencies
- **`res.currency.rate`**: Exchange rates

#### **📦 Products & Inventory**
- **`product.product`**: Products
- **`product.template`**: Product templates
- **`product.category`**: Product categories
- **`product.uom`**: Units of measure
- **`product.uom.categ`**: UOM categories
- **`stock.warehouse`**: Warehouses
- **`stock.location`**: Stock locations
- **`stock.move`**: Stock moves
- **`stock.move.line`**: Stock move lines
- **`stock.picking`**: Stock pickings
- **`stock.picking.type`**: Picking types
- **`stock.quant`**: Stock quants
- **`stock.inventory`**: Inventory adjustments
- **`stock.rule`**: Stock rules
- **`stock.route`**: Stock routes

#### **💰 Sales & CRM**
- **`sale.order`**: Sales orders
- **`sale.order.line`**: Sales order lines
- **`crm.lead`**: Leads and opportunities
- **`crm.stage`**: CRM stages
- **`crm.tag`**: CRM tags
- **`crm.team`**: Sales teams
- **`sale.report`**: Sales reports
- **`account.invoice`**: Customer invoices (legacy)
- **`account.invoice.line`**: Invoice lines (legacy)

#### **🛒 Purchases**
- **`purchase.order`**: Purchase orders
- **`purchase.order.line`**: Purchase order lines
- **`purchase.requisition`**: Purchase requisitions
- **`purchase.requisition.line`**: Requisition lines
- **`purchase.report`**: Purchase reports
- **`account.invoice`**: Supplier invoices (legacy)
- **`account.invoice.line`**: Invoice lines (legacy)

#### **🏭 Manufacturing**
- **`mrp.production`**: Manufacturing orders
- **`mrp.workorder`**: Work orders
- **`mrp.workcenter`**: Work centers
- **`mrp.routing`**: Routings
- **`mrp.bom`**: Bills of materials
- **`mrp.bom.line`**: BOM lines
- **`mrp.unbuild`**: Unbuild orders
- **`mrp.repair`**: Repair orders

#### **👷 Human Resources**
- **`hr.employee`**: Employees
- **`hr.department`**: Departments
- **`hr.job`**: Job positions
- **`hr.contract`**: Employment contracts
- **`hr.leave`**: Leave requests
- **`hr.leave.type`**: Leave types
- **`hr.attendance`**: Attendance records
- **`hr.payslip`**: Payslips
- **`hr.payslip.run`**: Payslip batches
- **`hr.expense`**: Expense reports
- **`hr.expense.sheet`**: Expense sheets

#### **📋 Project Management**
- **`project.project`**: Projects
- **`project.task`**: Tasks
- **`project.task.type`**: Task stages
- **`project.tags`**: Project tags
- **`account.analytic.line`**: Timesheet entries
- **`project.forecast`**: Project forecasts

#### **🏢 Real Estate**
- **`estate.property`**: Properties
- **`estate.property.type`**: Property types
- **`estate.property.tag`**: Property tags
- **`estate.property.offer`**: Property offers

#### **🔧 System & Configuration**
- **`ir.model`**: Model definitions
- **`ir.model.fields`**: Field definitions
- **`ir.model.data`**: Model data
- **`ir.actions.act_window`**: Window actions
- **`ir.actions.report`**: Report actions
- **`ir.actions.server`**: Server actions
- **`ir.ui.menu`**: Menu items
- **`ir.ui.view`**: Views
- **`ir.rule`**: Record rules
- **`ir.sequence`**: Sequences
- **`ir.config_parameter`**: Configuration parameters
- **`ir.translation`**: Translations
- **`ir.attachment`**: Attachments
- **`ir.logging`**: Log entries
- **`ir.cron`**: Scheduled actions
- **`ir.mail_server`**: Mail servers
- **`ir.config_parameter`**: System parameters

#### **📧 Communication**
- **`mail.message`**: Messages
- **`mail.thread`**: Message threading
- **`mail.followers`**: Followers
- **`mail.activity`**: Activities
- **`mail.activity.type`**: Activity types
- **`mail.template`**: Email templates
- **`mail.channel`**: Channels
- **`mail.alias`**: Email aliases

#### **🌐 Website & E-commerce**
- **`website`**: Websites
- **`website.page`**: Website pages
- **`website.menu`**: Website menus
- **`website.theme`**: Website themes
- **`sale.order`**: E-commerce orders
- **`product.public.category`**: Public product categories
- **`website.snippet`**: Website snippets

### **Standard Odoo API Methods**

#### **Core CRUD Operations**
- **`search(domain, limit, offset, order)`**: Search records
- **`search_count(domain)`**: Count matching records
- **`search_read(domain, fields, limit, offset, order)`**: Search and read
- **`read(ids, fields)`**: Read specific records
- **`create(values)`**: Create new records
- **`write(ids, values)`**: Update records
- **`unlink(ids)`**: Delete records
- **`exists(ids)`**: Check if records exist
- **`name_get(ids)`**: Get display names
- **`name_search(name, args, operator, limit)`**: Search by name

#### **Advanced Operations**
- **`copy(ids, default)`**: Copy records
- **`default_get(fields_list)`**: Get default values
- **`fields_get(allfields, attributes)`**: Get field definitions
- **`fields_view_get(view_id, view_type, toolbar, submenu)`**: Get view definitions
- **`load(ids, fields)`**: Load records with related data
- **`message_post(body, message_type, subtype, parent_id)`**: Post messages
- **`message_subscribe(partner_ids, channel_ids, subtype_ids)`**: Subscribe to messages
- **`message_unsubscribe(partner_ids, channel_ids)`**: Unsubscribe from messages

#### **Workflow Operations**
- **`button_confirm()`**: Confirm records
- **`button_cancel()`**: Cancel records
- **`button_draft()`**: Set to draft
- **`button_validate()`**: Validate records
- **`action_confirm()`**: Confirm action
- **`action_cancel()`**: Cancel action
- **`action_draft()`**: Set to draft action

#### **Reporting & Analytics**
- **`read_group(domain, fields, groupby, offset, limit, orderby, lazy)`**: Group by fields
- **`search_read_group(domain, fields, groupby, offset, limit, orderby, lazy)`**: Search and group
- **`get_report_data(ids, data)`**: Get report data
- **`render_report(ids, data)`**: Render reports

### **Domain Operators**

#### **Comparison Operators**
- **`=`**: Equal to
- **`!=`**: Not equal to
- **`>`**: Greater than
- **`<`**: Less than
- **`>=`**: Greater than or equal to
- **`<=`**: Less than or equal to

#### **Set Operators**
- **`in`**: Value is in list
- **`not in`**: Value is not in list
- **`like`**: Pattern matching (case-sensitive)
- **`ilike`**: Pattern matching (case-insensitive)
- **`=like`**: Pattern matching with wildcards
- **`=ilike`**: Case-insensitive pattern matching with wildcards
- **`child_of`**: Child of (hierarchical)
- **`parent_of`**: Parent of (hierarchical)

#### **Logical Operators**
- **`&`**: AND (default)
- **`|`**: OR
- **`!`**: NOT

### **Field Types**

#### **Basic Types**
- **`char`**: Character string
- **`text`**: Long text
- **`html`**: HTML content
- **`integer`**: Integer number
- **`float`**: Decimal number
- **`monetary`**: Monetary amount
- **`boolean`**: True/False
- **`date`**: Date
- **`datetime`**: Date and time
- **`binary`**: Binary data

#### **Relational Types**
- **`many2one`**: Many-to-one relationship
- **`one2many`**: One-to-many relationship
- **`many2many`**: Many-to-many relationship

#### **Selection Types**
- **`selection`**: Selection list
- **`reference`**: Reference to any model

### **Common Field Names**

#### **Standard Fields (Available in most models)**
- **`id`**: Record ID
- **`name`**: Display name
- **`display_name`**: Computed display name
- **`create_date`**: Creation date
- **`create_uid`**: Creator user
- **`write_date`**: Last modification date
- **`write_uid`**: Last modifier user
- **`active`**: Active flag
- **`company_id`**: Company
- **`user_id`**: Responsible user

#### **Partner Fields**
- **`partner_id`**: Partner reference
- **`customer`**: Is customer
- **`supplier`**: Is supplier
- **`is_company`**: Is company

#### **State Fields**
- **`state`**: Record state
- **`status`**: Status field

#### **Amount Fields**
- **`amount_total`**: Total amount
- **`amount_untaxed`**: Untaxed amount
- **`amount_tax`**: Tax amount
- **`amount_due`**: Amount due

---

**🎉 This comprehensive index covers all major Odoo tables, APIs, and field types available in standard Odoo installations.**
