from pydantic import BaseModel, Field
from typing import List, Optional

class QuantResponse(BaseModel):
    probabilities: List[float] = Field(description="List of probabilities for major outcomes.")
    expected_value: str = Field(description="Calculated expected value or quantitative summary.")
    risk_factors: List[str] = Field(description="List of quantifiable risk factors.")
    analysis: str = Field(description="Detailed quantitative analysis and probability tree description.")

class StrategistResponse(BaseModel):
    reversibility_score: int = Field(description="Score from 1 (irreversible) to 10 (easily reversible).")
    adversarial_moves: List[str] = Field(description="Potential adversarial reactions or worst-case scenarios.")
    strategic_recommendation: str = Field(description="Sun Tzu inspired strategic recommendation.")
    analysis: str = Field(description="Detailed game-theoretic and adversarial modeling analysis.")

class BehavioristResponse(BaseModel):
    cognitive_biases: List[str] = Field(description="Identified cognitive biases (e.g., sunk cost, availability heuristic).")
    blind_spots: List[str] = Field(description="Potential psychological blind spots in the user's framing.")
    behavioral_audit: str = Field(description="Audit of the decision through a behavioral economics lens.")

class JudgeResponse(BaseModel):
    synthesis: str = Field(description="Synthesis of the Quant, Strategist, and Behaviorist analyses.")
    final_verdict: str = Field(description="The definitive conclusion or verdict.")
    actionable_next_steps: List[str] = Field(description="1-3 concrete, actionable next steps based on first principles.")
