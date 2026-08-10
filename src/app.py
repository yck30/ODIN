import sys
import os
# Fix for Streamlit Cloud ModuleNotFoundError
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
import asyncio
from src.engine.orchestrator import execute_full_analysis_async

st.set_page_config(page_title="O.D.I.N. - Cognitive Engine", layout="wide")

st.title("O.D.I.N. 👁️")
st.markdown("### Omni-Dimensional Intelligence Node")
st.markdown("Submit your high-stakes dilemma for a rigorous 4-persona cognitive audit.")

with st.sidebar:
    st.header("About O.D.I.N.")
    st.markdown("O.D.I.N. processes decisions through:")
    st.markdown("1. **The Quant** (Expected Value)")
    st.markdown("2. **The Strategist** (Game Theory)")
    st.markdown("3. **The Behaviorist** (Bias Audit)")
    st.markdown("4. **The Judge** (First Principles Synthesis)")

# 1. Structured Intake Form
with st.form("intake_form"):
    st.subheader("Decision Intake")
    goal = st.text_input("What is the ultimate goal or decision to be made?", max_chars=200)
    context = st.text_area("What is the current situation and context?", max_chars=2000)
    risks = st.text_area("What are your biggest known fears or risks regarding this?", max_chars=2000)
    
    submitted = st.form_submit_button("Run Cognitive Audit")

if submitted:
    if not goal.strip() or not context.strip():
        st.warning("Please provide at least a Goal and Context.")
    else:
        # Construct the unified scenario string
        scenario = f"GOAL: {goal}\nCONTEXT: {context}\nKNOWN RISKS: {risks}"
        
        # 2. Progressive Disclosure Status
        status_container = st.status("Initializing O.D.I.N. cognitive engine...", expanded=True)
        
        try:
            # Helper to update UI dynamically during sequential processing
            def update_status(text: str):
                status_container.write(text)

            # Execute engine sequentially with status callback
            results = asyncio.run(execute_full_analysis_async(scenario, status_cb=update_status))
            
            status_container.update(label="Audit Complete!", state="complete", expanded=False)
            
            st.divider()
            
            # 3. Mobile-Friendly Multi-Tab Display
            st.header("Cognitive Audit Results")
            
            tab_verdict, tab_quant, tab_strat, tab_behav = st.tabs([
                "⚖️ The Verdict", 
                "📊 The Quant", 
                "⚔️ The Strategist", 
                "👁️ The Behaviorist"
            ])
            
            with tab_verdict:
                judge_res = results["judge"]
                # Display Final Verdict Prominently
                st.info(judge_res.final_verdict)
                
                st.subheader("Synthesis")
                st.write(judge_res.synthesis)
                
                st.subheader("Actionable Next Steps")
                for step in judge_res.actionable_next_steps:
                    st.markdown(f"- **{step}**")
                    
            with tab_quant:
                q = results["quant"]
                st.metric("Expected Value", q.expected_value)
                st.write("**Probabilities:**", q.probabilities)
                st.write("**Risk Factors:**")
                for r in q.risk_factors: st.write(f"- {r}")
                st.write("**Analysis:**", q.analysis)
                
            with tab_strat:
                s = results["strategist"]
                st.metric("Reversibility Score (1-10)", s.reversibility_score)
                st.write("**Adversarial Moves:**")
                for a in s.adversarial_moves: st.write(f"- {a}")
                st.write("**Strategic Rec:**", s.strategic_recommendation)
                st.write("**Analysis:**", s.analysis)
                
            with tab_behav:
                b = results["behaviorist"]
                st.write("**Cognitive Biases:**")
                for bias in b.cognitive_biases: st.write(f"- {bias}")
                st.write("**Blind Spots:**")
                for blind in b.blind_spots: st.write(f"- {blind}")
                st.write("**Audit:**", b.behavioral_audit)

        except Exception as e:
            status_container.update(label="Audit Failed.", state="error")
            import logging
            logging.error(f"Engine Exception: {e}", exc_info=True)
            err_msg = str(e)
            if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg:
                st.error("⏳ **Gemini Free Tier Limit Reached**")
                st.warning("""
                Google Gemini Free Tier daily requests (20 RPD) or per-minute rate limits have been temporarily reached.
                - **Daily Quotas:** Reset automatically every **24 hours / midnight UTC**.
                - **Temporary Spikes:** Wait 1–2 minutes before trying again.
                - **Instant Fix:** Upgrade your key to a Pay-As-You-Go project in [Google AI Studio](https://aistudio.google.com/) or switch your model API key.
                """)
            else:
                st.error("An error occurred while generating the audit. Please check your API key, ensure the scenario isn't too vague, and try again.")
