#!/usr/bin/env python3
"""
Simple MCP Odoo Server
A basic MCP server for Odoo integration that works with the current setup
"""

import asyncio
import json
import os
import sys
from typing import Any, Dict, List, Optional

import httpx
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route


class SimpleMCPOdooServer:
    def __init__(self):
        self.odoo_url = os.getenv("ODOO_URL", "https://hemisphere1.odoo.com")
        self.odoo_db = os.getenv("ODOO_DB", "hemisphere1")
        self.odoo_username = os.getenv("ODOO_USERNAME", "thomas@hemisphere.ai")
        self.odoo_password = os.getenv("ODOO_API_KEY", "")
        self.uid = None

    async def authenticate(self):
        """Authenticate with Odoo"""
        try:
            auth_data = {
                "jsonrpc": "2.0",
                "method": "call",
                "params": {
                    "db": self.odoo_db,
                    "login": self.odoo_username,
                    "password": self.odoo_password,
                },
                "id": 1,
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.odoo_url}/web/session/authenticate",
                    json=auth_data,
                    timeout=30.0,
                )

                if response.status_code == 200:
                    result = response.json()
                    if "result" in result and result["result"]:
                        self.uid = result["result"].get("uid")
                        return True

        except Exception as e:
            print(f"Authentication failed: {e}")

        return False

    async def search_read(
        self, model: str, domain: List, fields: List[str], limit: int = 100
    ):
        """Search and read records from Odoo"""
        if not self.uid:
            await self.authenticate()

        if not self.uid:
            return {"error": "Authentication failed"}

        try:
            search_data = {
                "jsonrpc": "2.0",
                "method": "call",
                "params": {
                    "service": "object",
                    "method": "execute_kw",
                    "args": [
                        self.odoo_db,
                        self.uid,
                        self.odoo_password,
                        model,
                        "search_read",
                        domain,
                        {"fields": fields, "limit": limit},
                    ],
                },
                "id": 1,
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.odoo_url}/web/dataset/call_kw",
                    json=search_data,
                    timeout=30.0,
                )

                if response.status_code == 200:
                    result = response.json()
                    if "result" in result:
                        return {"success": True, "data": result["result"]}
                    else:
                        return {"error": result.get("error", "Unknown error")}

        except Exception as e:
            return {"error": str(e)}

    async def get_models(self):
        """Get available models"""
        if not self.uid:
            await self.authenticate()

        if not self.uid:
            return {"error": "Authentication failed"}

        try:
            models_data = {
                "jsonrpc": "2.0",
                "method": "call",
                "params": {
                    "service": "object",
                    "method": "execute_kw",
                    "args": [
                        self.odoo_db,
                        self.uid,
                        self.odoo_password,
                        "ir.model",
                        "search_read",
                        [],
                        {"fields": ["model", "name"]},
                    ],
                },
                "id": 1,
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.odoo_url}/web/dataset/call_kw",
                    json=models_data,
                    timeout=30.0,
                )

                if response.status_code == 200:
                    result = response.json()
                    if "result" in result:
                        return {"success": True, "data": result["result"]}
                    else:
                        return {"error": result.get("error", "Unknown error")}

        except Exception as e:
            return {"error": str(e)}


# Create server instance
server = SimpleMCPOdooServer()

# Create Starlette app
app = Starlette()


@app.route("/health")
async def health(request):
    """Health check endpoint"""
    return JSONResponse({"status": "OK", "message": "MCP Odoo Server is running"})


@app.route("/odoo://models")
async def get_models(request):
    """Get available Odoo models"""
    result = await server.get_models()
    return JSONResponse(result)


@app.route("/odoo://model/{model}")
async def get_model_info(request):
    """Get model information"""
    model = request.path_params["model"]
    # For now, return basic info
    return JSONResponse(
        {
            "model": model,
            "fields": ["id", "name", "create_date", "write_date"],
            "message": "Model info endpoint - basic implementation",
        }
    )


@app.route("/odoo://search/{model}/{domain}")
async def search_records(request):
    """Search records with domain"""
    model = request.path_params["model"]
    domain_str = request.path_params["domain"]

    try:
        # Parse domain from URL
        domain = json.loads(domain_str)
        result = await server.search_read(model, domain, ["id", "name"])
        return JSONResponse(result)
    except Exception as e:
        return JSONResponse({"error": f"Invalid domain format: {e}"})


@app.route("/api/execute")
async def execute_query(request):
    """Execute custom Odoo query"""
    try:
        body = await request.json()
        model = body.get("model", "account.move")
        domain = body.get("domain", [])
        fields = body.get("fields", ["id", "name"])
        limit = body.get("limit", 100)

        result = await server.search_read(model, domain, fields, limit)
        return JSONResponse(result)
    except Exception as e:
        return JSONResponse({"error": str(e)})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=3001)
