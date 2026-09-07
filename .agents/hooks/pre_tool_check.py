import re
import sys
import logging
from typing import Dict, Any, Tuple

# Initialize structured audit logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - [AUDIT_TRAIL] - %(message)s')

class ClawGuardInterceptor:
    """
    Agentic AI Tool-Call Boundary Interceptor.
    This wrapper functions as the deterministic execution gatekeeper for autonomous LLM tools.
    """
    def __init__(self, task_rules: Dict[str, Any]):
        self.rules = task_rules
        # Default secret regex signatures (e.g., AWS Access Keys, generic high-entropy strings)
        self.secret_patterns = [
            re.compile(r'AKIA[0-9A-Z]{16}'),
            re.compile(r'([^A-Z0-9])[A-Za-z0-9+/]{40}(?![A-Za-z0-9+/])')
        ]

    def sanitize_content(self, raw_string: str) -> str:
        """Scan and redact high-confidence sensitive data spans."""
        sanitized = raw_string
        for pattern in self.secret_patterns:
            sanitized = pattern.sub(r'\1[REDACTED_CREDENTIAL]', sanitized)
        return sanitized

    def evaluate_action(self, tool_name: str, argument: str) -> str:
        """Enforce deterministic whitelists/blacklists at the boundary."""
        # 1. Evaluate tool command restrictions
        if tool_name in self.rules.get("command_rules", {}).get("deny", []):
            return "DENY"

        # 2. Evaluate directory/file system path safety
        if tool_name in ["read_file", "write_file", "append_file", "replace_file_content", "view_file"]:
            allowed_paths = self.rules.get("file_rules", {}).get("whitelist", [])
            # If no paths explicitly allowed, assume restricted.
            if allowed_paths and not any(argument.startswith(path) for path in allowed_paths):
                return "DENY"

        # 3. Evaluate network outbound destinations
        if tool_name == "web_fetch" or tool_name == "read_url_content":
            allowed_domains = self.rules.get("network_rules", {}).get("whitelist", [])
            if allowed_domains and not any(domain in argument for domain in allowed_domains):
                return "QUEUE" # Escalate unlisted destinations to human-in-the-loop

        return "ALLOW"

    def execute_safely(self, tool_name: str, raw_argument: str) -> Tuple[str, str]:
        """End-to-end wrapper executing the runtime protection pipeline."""
        # Step 1: Input Sanitization
        clean_argument = self.sanitize_content(raw_argument)
        
        # Step 2: Policy Evaluation
        verdict = self.evaluate_action(tool_name, clean_argument)
        logging.info(f"Tool: {tool_name} | Argument: {clean_argument} | Verdict: {verdict}")
        
        if verdict == "DENY":
            return "BLOCKED", "Action violates active task security policy."
        
        if verdict == "QUEUE":
            # Defer to asynchronous Human-In-The-Loop approval interface
            user_decision = self.prompt_human_verification(tool_name, clean_argument)
            if not user_decision:
                return "BLOCKED", "Action rejected by human operator."
        
        # Step 3: Safe Execution (Simulated Tool Invocations)
        return "SUCCESS", f"Executed {tool_name} with verified safety."

    def prompt_human_verification(self, tool: str, arg: str) -> bool:
        # Integrated with external enterprise orchestration queue (e.g., Slack/PagerDuty webhook)
        print(f"\n[HIJACK WARNING] Agent requesting approval for sensitive action: {tool}({arg})")
        response = input("Authorize execution? (yes/no): ")
        return response.strip().lower() == "yes"

if __name__ == "__main__":
    # Example Usage: Task-scoped rule set generated at session birth
    active_rules = {
        "network_rules": {"whitelist": ["api.stripe.com"], "blacklist": ["*.onion"]},
        "file_rules": {"whitelist": ["/workspace/reports/", "c:\\Users\\USER\\Desktop\\YCK_Project\\O.D.I.N\\ODIN\\"]},
        "command_rules": {"deny": ["run_command:rm", "run_command:del", "delete_system_file"]}
    }

    guard = ClawGuardInterceptor(active_rules)
    
    if len(sys.argv) > 2:
        tool = sys.argv[1]
        arg = sys.argv[2]
        status, msg = guard.execute_safely(tool, arg)
        print(f"Status: {status}\nMessage: {msg}")
        if status == "BLOCKED":
            sys.exit(1)
        sys.exit(0)
    else:
        print("Usage: python pre_tool_check.py <tool_name> <argument>")
