// Gerado por cloudflare/tools/gen_policies.py — não edite à mão.
export const RLS = {"profiles": true, "user_roles": true, "permissions": true, "role_permissions": true, "events": true, "event_expenses": true, "event_equipment": true, "equipment": true, "clients": true, "event_collaborators": true, "bank_accounts": true, "bank_transactions": true, "company_settings": true, "user_credentials": true, "user_theme_preferences": true, "collaborators": true, "maintenance_records": true, "patrimony_inventory": true, "interstate_transports": true, "recurring_expenses": true, "recurring_expense_payment_plans": true, "recurring_expense_monthly_payments": true, "event_budgets": true, "bank_cards": true, "contracts": true, "contract_attachments": true, "contract_payments": true, "external_quotes": true, "saved_signatures": true, "bank_card_transactions": true, "daily_rates": true, "worker_advances": true, "workers": true, "collaborator_payments": true, "collaborator_advances": true, "collaborator_monthly_salaries": true, "worker_expense_advances": true, "collaborator_expense_advances": true, "client_advances": true, "client_custom_items": true, "saved_bank_accounts": true, "company_expenses": true, "user_permissions": true, "approval_requests": true, "audit_log": true, "company_fixed_expenses": true, "company_fixed_expense_monthly_payments": true, "event_contracts": true, "collaborator_food_allowances": true, "worker_food_allowances": true, "whatsapp_messages": true, "nfse_invoices": true, "nfse_certificates": true, "nfse_config": true, "app_error_logs": true, "audit_logs": true, "event_checklists": true, "event_checklist_items": true, "quote_approvals": true, "message_templates": true, "contract_templates": true, "contract_history": true, "person_sensitive_data": true, "person_status_history": true, "worker_availability": true, "finance_titles": true, "finance_installments": true, "finance_payments": true, "bank_transaction_reconciliations": true, "bank_account_closings": true, "personal_accounts": true, "personal_categories": true, "personal_recurrences": true, "personal_expenses": true, "personal_budgets": true, "personal_expense_attachments": true, "fiscal_profiles": true, "fiscal_documents": true, "fiscal_document_items": true, "fiscal_document_events": true, "event_transport_vehicles": true};
export const POLICIES = {
 "profiles": [
  {
   "cmd": "SELECT",
   "roles": [
    "public"
   ],
   "using": {
    "owner": "user_id"
   },
   "check": null,
   "restrictive": false,
   "name": "Users can view their own profile"
  },
  {
   "cmd": "UPDATE",
   "roles": [
    "public"
   ],
   "using": {
    "owner": "user_id"
   },
   "check": null,
   "restrictive": false,
   "name": "Users can update their own profile"
  },
  {
   "cmd": "INSERT",
   "roles": [
    "public"
   ],
   "using": null,
   "check": {
    "owner": "user_id"
   },
   "restrictive": false,
   "name": "Users can insert their own profile"
  },
  {
   "cmd": "UPDATE",
   "roles": [
    "authenticated"
   ],
   "using": {
    "or": [
     {
      "owner": "user_id"
     },
     {
      "anyRole": [
       "admin"
      ]
     }
    ]
   },
   "check": {
    "or": [
     {
      "owner": "user_id"
     },
     {
      "anyRole": [
       "admin"
      ]
     }
    ]
   },
   "restrictive": false,
   "name": "profiles_update_own_or_admin"
  },
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin"
    ]
   },
   "check": {
    "anyRole": [
     "admin"
    ]
   },
   "restrictive": false,
   "name": "profiles_admin_manage"
  },
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "or": [
     {
      "owner": "user_id"
     },
     {
      "anyRole": [
       "admin"
      ]
     }
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "profiles_select_self_or_admin"
  }
 ],
 "permissions": [
  {
   "cmd": "SELECT",
   "roles": [
    "public"
   ],
   "using": {
    "anyRole": [
     "admin"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "Admins can view all permissions"
  },
  {
   "cmd": "ALL",
   "roles": [
    "public"
   ],
   "using": {
    "anyRole": [
     "admin"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "Admins can manage permissions"
  },
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": true,
   "check": null,
   "restrictive": false,
   "name": "perm_read_authenticated"
  },
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin"
    ]
   },
   "check": {
    "anyRole": [
     "admin"
    ]
   },
   "restrictive": false,
   "name": "perm_admin_write"
  }
 ],
 "role_permissions": [
  {
   "cmd": "SELECT",
   "roles": [
    "public"
   ],
   "using": {
    "anyRole": [
     "admin"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "Admins can view all role permissions"
  },
  {
   "cmd": "ALL",
   "roles": [
    "public"
   ],
   "using": {
    "anyRole": [
     "admin"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "Admins can manage role permissions"
  },
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": true,
   "check": null,
   "restrictive": false,
   "name": "rp_read_authenticated"
  },
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin"
    ]
   },
   "check": {
    "anyRole": [
     "admin"
    ]
   },
   "restrictive": false,
   "name": "rp_admin_write"
  }
 ],
 "user_roles": [
  {
   "cmd": "SELECT",
   "roles": [
    "public"
   ],
   "using": {
    "owner": "user_id"
   },
   "check": null,
   "restrictive": false,
   "name": "Users can view their own role"
  },
  {
   "cmd": "ALL",
   "roles": [
    "public"
   ],
   "using": {
    "and": [
     {
      "auth": true
     },
     {
      "anyRole": [
       "admin"
      ]
     }
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "Admins can manage all user roles"
  },
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "or": [
     {
      "owner": "user_id"
     },
     {
      "anyRole": [
       "admin"
      ]
     }
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "ur_select_self_or_admin"
  },
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin"
    ]
   },
   "check": {
    "anyRole": [
     "admin"
    ]
   },
   "restrictive": false,
   "name": "ur_admin_manage"
  }
 ],
 "user_credentials": [
  {
   "cmd": "SELECT",
   "roles": [
    "public"
   ],
   "using": {
    "owner": "id"
   },
   "check": null,
   "restrictive": false,
   "name": "Users can view their own credentials"
  },
  {
   "cmd": "ALL",
   "roles": [
    "public"
   ],
   "using": {
    "and": [
     {
      "auth": true
     },
     {
      "anyRole": [
       "admin"
      ]
     }
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "Admins can manage all user credentials"
  },
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "or": [
     {
      "owner": "id"
     },
     {
      "anyRole": [
       "admin"
      ]
     }
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "uc_select_self_or_admin"
  },
  {
   "cmd": "INSERT",
   "roles": [
    "authenticated"
   ],
   "using": null,
   "check": {
    "anyRole": [
     "admin"
    ]
   },
   "restrictive": false,
   "name": "uc_admin_insert"
  },
  {
   "cmd": "UPDATE",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin"
    ]
   },
   "check": {
    "anyRole": [
     "admin"
    ]
   },
   "restrictive": false,
   "name": "uc_admin_update"
  },
  {
   "cmd": "DELETE",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "uc_admin_delete"
  }
 ],
 "contract_attachments": [
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": true,
   "check": null,
   "restrictive": false,
   "name": "Users can view contract attachments"
  },
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "Only admins and financeiro can manage attachments"
  },
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Comercial write"
  },
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro",
     "funcionario",
     "deposito"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "Comercial read"
  }
 ],
 "contract_payments": [
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": true,
   "check": null,
   "restrictive": false,
   "name": "Users can view contract payments"
  },
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "Only admins and financeiro can manage payments"
  },
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Financeiro full access"
  }
 ],
 "user_permissions": [
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "or": [
     {
      "owner": "user_id"
     },
     {
      "anyRole": [
       "admin"
      ]
     }
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "up_select_self_or_admin"
  },
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin"
    ]
   },
   "check": {
    "anyRole": [
     "admin"
    ]
   },
   "restrictive": false,
   "name": "up_admin_manage"
  }
 ],
 "nfse_certificates": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin"
    ]
   },
   "check": {
    "anyRole": [
     "admin"
    ]
   },
   "restrictive": false,
   "name": "nfse_cert_admin_only"
  }
 ],
 "bank_cards": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Financeiro full access"
  }
 ],
 "bank_card_transactions": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Financeiro full access"
  }
 ],
 "company_expenses": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Financeiro full access"
  }
 ],
 "company_fixed_expenses": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Financeiro full access"
  }
 ],
 "company_fixed_expense_monthly_payments": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Financeiro full access"
  }
 ],
 "recurring_expenses": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Financeiro full access"
  }
 ],
 "recurring_expense_monthly_payments": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Financeiro full access"
  }
 ],
 "recurring_expense_payment_plans": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Financeiro full access"
  }
 ],
 "collaborator_advances": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Financeiro full access"
  }
 ],
 "collaborator_expense_advances": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Financeiro full access"
  }
 ],
 "collaborator_food_allowances": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Financeiro full access"
  }
 ],
 "collaborator_monthly_salaries": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Financeiro full access"
  }
 ],
 "collaborator_payments": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Financeiro full access"
  }
 ],
 "worker_advances": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Financeiro full access"
  }
 ],
 "worker_expense_advances": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Financeiro full access"
  }
 ],
 "worker_food_allowances": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Financeiro full access"
  }
 ],
 "daily_rates": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Financeiro full access"
  }
 ],
 "client_advances": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Financeiro full access"
  }
 ],
 "event_expenses": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Financeiro full access"
  }
 ],
 "event_budgets": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Financeiro full access"
  },
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro",
     "funcionario",
     "deposito"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "Funcionario read event_budgets"
  }
 ],
 "saved_bank_accounts": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Financeiro full access"
  }
 ],
 "external_quotes": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Financeiro full access"
  },
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro",
     "funcionario",
     "deposito"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "Funcionario read external_quotes"
  }
 ],
 "audit_log": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Financeiro full access"
  }
 ],
 "approval_requests": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Financeiro full access"
  }
 ],
 "clients": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Comercial write"
  },
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro",
     "funcionario",
     "deposito"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "Comercial read"
  }
 ],
 "events": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Comercial write"
  },
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro",
     "funcionario",
     "deposito"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "Comercial read"
  }
 ],
 "contracts": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Comercial write"
  },
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro",
     "funcionario",
     "deposito"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "Comercial read"
  }
 ],
 "event_contracts": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Comercial write"
  },
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro",
     "funcionario",
     "deposito"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "Comercial read"
  }
 ],
 "client_custom_items": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Comercial write"
  },
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro",
     "funcionario",
     "deposito"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "Comercial read"
  }
 ],
 "event_collaborators": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Comercial write"
  },
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro",
     "funcionario",
     "deposito"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "Comercial read"
  }
 ],
 "equipment": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "funcionario",
     "deposito"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "funcionario",
     "deposito"
    ]
   },
   "restrictive": false,
   "name": "Equip write"
  },
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro",
     "funcionario",
     "deposito"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "Equip read"
  }
 ],
 "maintenance_records": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "funcionario",
     "deposito"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "funcionario",
     "deposito"
    ]
   },
   "restrictive": false,
   "name": "Equip write"
  },
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro",
     "funcionario",
     "deposito"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "Equip read"
  }
 ],
 "patrimony_inventory": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "funcionario",
     "deposito"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "funcionario",
     "deposito"
    ]
   },
   "restrictive": false,
   "name": "Equip write"
  },
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro",
     "funcionario",
     "deposito"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "Equip read"
  }
 ],
 "event_equipment": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "funcionario",
     "deposito"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "funcionario",
     "deposito"
    ]
   },
   "restrictive": false,
   "name": "Equip write"
  },
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro",
     "funcionario",
     "deposito"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "Equip read"
  }
 ],
 "interstate_transports": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "funcionario",
     "deposito"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "funcionario",
     "deposito"
    ]
   },
   "restrictive": false,
   "name": "Equip write"
  },
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro",
     "funcionario",
     "deposito"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "Equip read"
  }
 ],
 "collaborators": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "People write"
  },
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro",
     "funcionario",
     "deposito"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "People read"
  }
 ],
 "workers": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "People write"
  },
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro",
     "funcionario",
     "deposito"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "People read"
  }
 ],
 "whatsapp_messages": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin"
    ]
   },
   "check": {
    "anyRole": [
     "admin"
    ]
   },
   "restrictive": false,
   "name": "Whats write"
  },
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro",
     "funcionario"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "Whats read"
  }
 ],
 "company_settings": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin"
    ]
   },
   "check": {
    "anyRole": [
     "admin"
    ]
   },
   "restrictive": false,
   "name": "Whats write"
  },
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro",
     "funcionario"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "Whats read"
  }
 ],
 "saved_signatures": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Signatures access"
  }
 ],
 "user_theme_preferences": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "owner": "user_id"
   },
   "check": {
    "owner": "user_id"
   },
   "restrictive": false,
   "name": "Own preferences"
  }
 ],
 "bank_accounts": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Financeiro full access"
  }
 ],
 "bank_transactions": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Financeiro full access"
  }
 ],
 "nfse_config": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Financeiro full access"
  }
 ],
 "nfse_invoices": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Financeiro full access"
  }
 ],
 "app_error_logs": [
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "Admins can read error logs"
  },
  {
   "cmd": "INSERT",
   "roles": [
    "authenticated"
   ],
   "using": null,
   "check": {
    "owner": "user_id"
   },
   "restrictive": false,
   "name": "Users insert own error logs"
  }
 ],
 "audit_logs": [
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "Admins can read audit logs"
  }
 ],
 "event_checklists": [
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": true,
   "check": null,
   "restrictive": false,
   "name": "checklists_select_authenticated"
  },
  {
   "cmd": "INSERT",
   "roles": [
    "authenticated"
   ],
   "using": null,
   "check": {
    "anyRole": [
     "admin",
     "funcionario",
     "deposito",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "checklists_write_operacional"
  },
  {
   "cmd": "UPDATE",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "funcionario",
     "deposito",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "funcionario",
     "deposito",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "checklists_update_operacional"
  },
  {
   "cmd": "DELETE",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "checklists_delete_admin"
  }
 ],
 "event_checklist_items": [
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": true,
   "check": null,
   "restrictive": false,
   "name": "checklist_items_select_authenticated"
  },
  {
   "cmd": "INSERT",
   "roles": [
    "authenticated"
   ],
   "using": null,
   "check": {
    "anyRole": [
     "admin",
     "funcionario",
     "deposito",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "checklist_items_write_operacional"
  },
  {
   "cmd": "UPDATE",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "funcionario",
     "deposito",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "funcionario",
     "deposito",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "checklist_items_update_operacional"
  },
  {
   "cmd": "DELETE",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "funcionario",
     "deposito"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "checklist_items_delete_operacional"
  }
 ],
 "quote_approvals": [
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "quote_approvals_select_comercial"
  },
  {
   "cmd": "INSERT",
   "roles": [
    "authenticated"
   ],
   "using": null,
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "quote_approvals_insert_comercial"
  },
  {
   "cmd": "UPDATE",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "quote_approvals_update_comercial"
  }
 ],
 "message_templates": [
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": true,
   "check": null,
   "restrictive": false,
   "name": "message_templates_select_authenticated"
  },
  {
   "cmd": "INSERT",
   "roles": [
    "authenticated"
   ],
   "using": null,
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "message_templates_write_comercial"
  },
  {
   "cmd": "UPDATE",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "message_templates_update_comercial"
  },
  {
   "cmd": "DELETE",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "message_templates_delete_admin"
  }
 ],
 "contract_templates": [
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro",
     "funcionario",
     "deposito"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "Comercial read"
  },
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Comercial write"
  }
 ],
 "contract_history": [
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro",
     "funcionario",
     "deposito"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "Comercial read"
  },
  {
   "cmd": "INSERT",
   "roles": [
    "authenticated"
   ],
   "using": null,
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Comercial insert"
  }
 ],
 "person_sensitive_data": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Somente admin e financeiro acessam dados sensiveis"
  }
 ],
 "person_status_history": [
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro",
     "funcionario",
     "deposito"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "Autenticados leem historico de status"
  },
  {
   "cmd": "INSERT",
   "roles": [
    "authenticated"
   ],
   "using": null,
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "Admin e financeiro registram historico de status"
  }
 ],
 "worker_availability": [
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro",
     "funcionario",
     "deposito"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "Perfis internos leem disponibilidade"
  },
  {
   "cmd": "INSERT",
   "roles": [
    "authenticated"
   ],
   "using": null,
   "check": {
    "anyRole": [
     "admin",
     "financeiro",
     "funcionario"
    ]
   },
   "restrictive": false,
   "name": "Escala cria disponibilidade"
  },
  {
   "cmd": "UPDATE",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro",
     "funcionario"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro",
     "funcionario"
    ]
   },
   "restrictive": false,
   "name": "Escala atualiza disponibilidade"
  },
  {
   "cmd": "DELETE",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro",
     "funcionario"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "Escala remove disponibilidade"
  }
 ],
 "finance_titles": [
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "finance_titles_read_finance"
  },
  {
   "cmd": "INSERT",
   "roles": [
    "authenticated"
   ],
   "using": null,
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "finance_titles_insert_finance"
  },
  {
   "cmd": "UPDATE",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "finance_titles_update_finance"
  }
 ],
 "finance_installments": [
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "finance_installments_read_finance"
  },
  {
   "cmd": "INSERT",
   "roles": [
    "authenticated"
   ],
   "using": null,
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "finance_installments_insert_finance"
  },
  {
   "cmd": "UPDATE",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "finance_installments_update_finance"
  }
 ],
 "finance_payments": [
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "finance_payments_read_finance"
  },
  {
   "cmd": "INSERT",
   "roles": [
    "authenticated"
   ],
   "using": null,
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "finance_payments_insert_finance"
  }
 ],
 "bank_transaction_reconciliations": [
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "btr_select"
  },
  {
   "cmd": "INSERT",
   "roles": [
    "authenticated"
   ],
   "using": null,
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "btr_insert"
  },
  {
   "cmd": "UPDATE",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "btr_update"
  },
  {
   "cmd": "DELETE",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "btr_delete"
  }
 ],
 "bank_account_closings": [
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "bac_select"
  },
  {
   "cmd": "INSERT",
   "roles": [
    "authenticated"
   ],
   "using": null,
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "bac_insert"
  }
 ],
 "personal_accounts": [
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "owner": "owner_id"
   },
   "check": null,
   "restrictive": false,
   "name": "personal_accounts_select_own"
  },
  {
   "cmd": "INSERT",
   "roles": [
    "authenticated"
   ],
   "using": null,
   "check": {
    "owner": "owner_id"
   },
   "restrictive": false,
   "name": "personal_accounts_insert_own"
  },
  {
   "cmd": "UPDATE",
   "roles": [
    "authenticated"
   ],
   "using": {
    "owner": "owner_id"
   },
   "check": {
    "owner": "owner_id"
   },
   "restrictive": false,
   "name": "personal_accounts_update_own"
  }
 ],
 "personal_categories": [
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "owner": "owner_id"
   },
   "check": null,
   "restrictive": false,
   "name": "personal_categories_select_own"
  },
  {
   "cmd": "INSERT",
   "roles": [
    "authenticated"
   ],
   "using": null,
   "check": {
    "owner": "owner_id"
   },
   "restrictive": false,
   "name": "personal_categories_insert_own"
  },
  {
   "cmd": "UPDATE",
   "roles": [
    "authenticated"
   ],
   "using": {
    "owner": "owner_id"
   },
   "check": {
    "owner": "owner_id"
   },
   "restrictive": false,
   "name": "personal_categories_update_own"
  }
 ],
 "personal_recurrences": [
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "owner": "owner_id"
   },
   "check": null,
   "restrictive": false,
   "name": "personal_recurrences_select_own"
  },
  {
   "cmd": "INSERT",
   "roles": [
    "authenticated"
   ],
   "using": null,
   "check": {
    "owner": "owner_id"
   },
   "restrictive": false,
   "name": "personal_recurrences_insert_own"
  },
  {
   "cmd": "UPDATE",
   "roles": [
    "authenticated"
   ],
   "using": {
    "owner": "owner_id"
   },
   "check": {
    "owner": "owner_id"
   },
   "restrictive": false,
   "name": "personal_recurrences_update_own"
  }
 ],
 "personal_expenses": [
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "owner": "owner_id"
   },
   "check": null,
   "restrictive": false,
   "name": "personal_expenses_select_own"
  },
  {
   "cmd": "INSERT",
   "roles": [
    "authenticated"
   ],
   "using": null,
   "check": {
    "owner": "owner_id"
   },
   "restrictive": false,
   "name": "personal_expenses_insert_own"
  },
  {
   "cmd": "UPDATE",
   "roles": [
    "authenticated"
   ],
   "using": {
    "owner": "owner_id"
   },
   "check": {
    "owner": "owner_id"
   },
   "restrictive": false,
   "name": "personal_expenses_update_own"
  }
 ],
 "personal_budgets": [
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "owner": "owner_id"
   },
   "check": null,
   "restrictive": false,
   "name": "personal_budgets_select_own"
  },
  {
   "cmd": "INSERT",
   "roles": [
    "authenticated"
   ],
   "using": null,
   "check": {
    "owner": "owner_id"
   },
   "restrictive": false,
   "name": "personal_budgets_insert_own"
  },
  {
   "cmd": "UPDATE",
   "roles": [
    "authenticated"
   ],
   "using": {
    "owner": "owner_id"
   },
   "check": {
    "owner": "owner_id"
   },
   "restrictive": false,
   "name": "personal_budgets_update_own"
  }
 ],
 "personal_expense_attachments": [
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "owner": "owner_id"
   },
   "check": null,
   "restrictive": false,
   "name": "personal_expense_attachments_select_own"
  },
  {
   "cmd": "INSERT",
   "roles": [
    "authenticated"
   ],
   "using": null,
   "check": {
    "owner": "owner_id"
   },
   "restrictive": false,
   "name": "personal_expense_attachments_insert_own"
  },
  {
   "cmd": "UPDATE",
   "roles": [
    "authenticated"
   ],
   "using": {
    "owner": "owner_id"
   },
   "check": {
    "owner": "owner_id"
   },
   "restrictive": false,
   "name": "personal_expense_attachments_update_own"
  },
  {
   "cmd": "DELETE",
   "roles": [
    "authenticated"
   ],
   "using": {
    "owner": "owner_id"
   },
   "check": null,
   "restrictive": false,
   "name": "personal_expense_attachments_delete_own"
  }
 ],
 "fiscal_profiles": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "fiscal_profiles_manage"
  },
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro",
     "deposito",
     "funcionario"
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "fiscal_profiles_read_basic"
  }
 ],
 "fiscal_documents": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "fiscal_documents_manage"
  },
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "owner": "created_by"
   },
   "check": null,
   "restrictive": false,
   "name": "fiscal_documents_read_own"
  }
 ],
 "fiscal_document_items": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "check": {
    "anyRole": [
     "admin",
     "financeiro"
    ]
   },
   "restrictive": false,
   "name": "fiscal_document_items_manage"
  },
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "sql": "EXISTS (SELECT 1 FROM \"fiscal_documents\" d WHERE d.id = $T.document_id AND d.created_by = ?)",
    "uid": 1
   },
   "check": null,
   "restrictive": false,
   "name": "fiscal_document_items_read_own"
  }
 ],
 "fiscal_document_events": [
  {
   "cmd": "SELECT",
   "roles": [
    "authenticated"
   ],
   "using": {
    "or": [
     {
      "anyRole": [
       "admin",
       "financeiro"
      ]
     },
     {
      "sql": "EXISTS (SELECT 1 FROM \"fiscal_documents\" d WHERE d.id = $T.document_id AND d.created_by = ?)",
      "uid": 1
     }
    ]
   },
   "check": null,
   "restrictive": false,
   "name": "fiscal_document_events_read"
  }
 ],
 "event_transport_vehicles": [
  {
   "cmd": "ALL",
   "roles": [
    "authenticated"
   ],
   "using": true,
   "check": true,
   "restrictive": false,
   "name": "Authenticated users manage event transport vehicles"
  }
 ]
};
