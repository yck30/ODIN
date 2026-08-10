import asyncio
import time
from google import genai
from google.genai import types
from src.config import get_api_key, GEMINI_MODEL
from src.schemas import QuantResponse, StrategistResponse, BehavioristResponse, JudgeResponse
from src.engine.personas import QUANT_SYSTEM_PROMPT, STRATEGIST_SYSTEM_PROMPT, BEHAVIORIST_SYSTEM_PROMPT, JUDGE_SYSTEM_PROMPT

def get_client():
    api_key = get_api_key()
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set.")
    return genai.Client(api_key=api_key)

async def _call_gemini_async(client: genai.Client, system_instruction: str, user_prompt: str, schema_class, max_retries: int = 4):
    loop = asyncio.get_running_loop()
    
    def _make_call():
        for attempt in range(max_retries):
            try:
                return client.models.generate_content(
                    model=GEMINI_MODEL,
                    contents=user_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        response_mime_type="application/json",
                        response_schema=schema_class,
                        temperature=0.2, # Low temperature for more deterministic analysis
                    ),
                )
            except Exception as e:
                err_str = str(e)
                # Exponential backoff for Rate Limits (429) or Service Unavailable (503)
                if ("429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "503" in err_str or "UNAVAILABLE" in err_str) and attempt < max_retries - 1:
                    wait_time = (2 ** (attempt + 2)) + 1 # 5s, 9s, 17s
                    time.sleep(wait_time)
                    continue
                raise e

    response = await loop.run_in_executor(None, _make_call)
    
    if hasattr(response, 'parsed') and response.parsed:
        return response.parsed
    else:
        return schema_class.model_validate_json(response.text)

async def run_quant(client: genai.Client, scenario: str) -> QuantResponse:
    return await _call_gemini_async(client, QUANT_SYSTEM_PROMPT, scenario, QuantResponse)

async def run_strategist(client: genai.Client, scenario: str) -> StrategistResponse:
    return await _call_gemini_async(client, STRATEGIST_SYSTEM_PROMPT, scenario, StrategistResponse)

async def run_behaviorist(client: genai.Client, scenario: str) -> BehavioristResponse:
    return await _call_gemini_async(client, BEHAVIORIST_SYSTEM_PROMPT, scenario, BehavioristResponse)

def run_judge_sync(client: genai.Client, scenario: str, quant: QuantResponse, strat: StrategistResponse, behav: BehavioristResponse) -> JudgeResponse:
    judge_prompt = f"""
    USER SCENARIO:
    {scenario}
    
    ---
    QUANTITATIVE ANALYSIS:
    {quant.model_dump_json(indent=2)}
    
    ---
    STRATEGIC ANALYSIS:
    {strat.model_dump_json(indent=2)}
    
    ---
    BEHAVIORAL ANALYSIS:
    {behav.model_dump_json(indent=2)}
    
    Please synthesize this and provide the final verdict.
    """
    
    for attempt in range(4):
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=judge_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=JUDGE_SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    response_schema=JudgeResponse,
                    temperature=0.2,
                ),
            )
            break
        except Exception as e:
            err_str = str(e)
            if ("429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "503" in err_str or "UNAVAILABLE" in err_str) and attempt < 3:
                time.sleep((2 ** (attempt + 2)) + 1)
                continue
            raise e
    
    if hasattr(response, 'parsed') and response.parsed:
        return response.parsed
    return JudgeResponse.model_validate_json(response.text)

async def execute_full_analysis_async(scenario: str, status_cb=None):
    """
    Executes 4-persona analysis sequentially to stay within Gemini API free-tier RPM limits (5 RPM).
    Accepts an optional callback `status_cb(str)` to push real-time status updates to UI.
    """
    client = get_client()

    # 1. Quant Pass
    if status_cb: status_cb("⚙️ Step 1/4: The Quant is running expected value calculations...")
    quant_res = await run_quant(client, scenario)
    await asyncio.sleep(2.5) # Gentle pause to preserve RPM quota

    # 2. Strategist Pass
    if status_cb: status_cb("⚔️ Step 2/4: The Strategist is modeling adversarial vectors...")
    strat_res = await run_strategist(client, scenario)
    await asyncio.sleep(2.5)

    # 3. Behaviorist Pass
    if status_cb: status_cb("👁️ Step 3/4: The Behaviorist is auditing for cognitive biases...")
    behav_res = await run_behaviorist(client, scenario)
    await asyncio.sleep(2.5)

    # 4. Judge Pass
    if status_cb: status_cb("⚖️ Step 4/4: The Judge is synthesizing the final verdict...")
    judge_res = run_judge_sync(client, scenario, quant_res, strat_res, behav_res)

    return {
        "quant": quant_res,
        "strategist": strat_res,
        "behaviorist": behav_res,
        "judge": judge_res
    }
