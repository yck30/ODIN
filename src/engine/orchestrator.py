import asyncio
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

async def _call_gemini_async(client: genai.Client, system_instruction: str, user_prompt: str, schema_class):
    # Using the standard sync SDK method, but wrapping it in a thread for parallel execution via asyncio
    # google-genai does have experimental async, but `asyncio.to_thread` with the sync client is very stable.
    loop = asyncio.get_running_loop()
    
    def _make_call():
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

    response = await loop.run_in_executor(None, _make_call)
    
    # Parse the structured JSON into the Pydantic model
    # Note: google-genai usually returns response.parsed if we pass response_schema correctly.
    if hasattr(response, 'parsed') and response.parsed:
        return response.parsed
    else:
        # Fallback if parsed isn't automatically populated
        return schema_class.model_validate_json(response.text)


async def run_quant(client: genai.Client, scenario: str) -> QuantResponse:
    return await _call_gemini_async(client, QUANT_SYSTEM_PROMPT, scenario, QuantResponse)

async def run_strategist(client: genai.Client, scenario: str) -> StrategistResponse:
    return await _call_gemini_async(client, STRATEGIST_SYSTEM_PROMPT, scenario, StrategistResponse)

async def run_behaviorist(client: genai.Client, scenario: str) -> BehavioristResponse:
    return await _call_gemini_async(client, BEHAVIORIST_SYSTEM_PROMPT, scenario, BehavioristResponse)

def run_judge_sync(client: genai.Client, scenario: str, quant: QuantResponse, strat: StrategistResponse, behav: BehavioristResponse) -> JudgeResponse:
    # Build prompt for Judge
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
    
    if hasattr(response, 'parsed') and response.parsed:
        return response.parsed
    return JudgeResponse.model_validate_json(response.text)


async def execute_full_analysis_async(scenario: str):
    client = get_client()
    
    # Run first 3 in parallel
    results = await asyncio.gather(
        run_quant(client, scenario),
        run_strategist(client, scenario),
        run_behaviorist(client, scenario)
    )
    
    quant_res, strat_res, behav_res = results
    
    # Run judge sequentially
    judge_res = run_judge_sync(client, scenario, quant_res, strat_res, behav_res)
    
    return {
        "quant": quant_res,
        "strategist": strat_res,
        "behaviorist": behav_res,
        "judge": judge_res
    }
