from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
import logging
import os

load_dotenv()

logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')

if not GEMINI_API_KEY:
    raise RuntimeError('Missing GEMINI_API_KEY in environment')

client = genai.Client(api_key=GEMINI_API_KEY)

class TaskItem(BaseModel):
    title: str
    description: str
    estimate_hours: float
    priority: str = 'Medium'
    deadline: str = ''
    completed: bool = False

class GeneratePlanRequest(BaseModel):
    username: str
    tasks: list[TaskItem]

class CoachRequest(BaseModel):
    username: str
    tasks: list[TaskItem]
    question: str

class InsightRequest(BaseModel):
    username: str
    tasks: list[TaskItem]

@app.post('/api/generate-plan')
def generate_plan(request: GeneratePlanRequest):
    prompt_lines = [
        f"Task: {task.title}\nDescription: {task.description}\nEstimated hours: {task.estimate_hours}" for task in request.tasks
    ]
    prompt = (
        "You are an expert senior productivity mentor for a hackathon team. "
        "Create a highly structured execution plan using this EXACT format:\n\n"
        "TODAY'S EXECUTION PLAN 🟢\n\n"
        "⚡ Priority 1\n"
        "[Task Title]\n"
        "Time: HH:MM-HH:MM\n"
        "Reason: [Why this task first - 1 sentence]\n"
        "[Optional: Risk/Blocker if applicable]\n"
        "[Optional: Recommendation to save time]\n\n"
        "🔥 Priority 2\n"
        "[Task Title]\n"
        "Time: HH:MM-HH:MM\n"
        "Reason: [Why this task second - 1 sentence]\n"
        "[Optional: Risk/Blocker if applicable]\n"
        "[Optional: Recommendation to save time]\n\n"
        "[Continue for each task with decreasing priority emojis: 💪, 📌, etc.]\n\n"
        "KEY INSIGHTS:\n"
        "- Prioritize the most critical and dependency-driven work first\n"
        "- Assign realistic time blocks starting from 9 AM\n"
        "- For each task, explain WHY it should be done when\n"
        "- Call out any risks or potential blockers\n"
        "- Give specific recommendations if workload is heavy\n\n"
        f"User: {request.username}\n\n"
        "Tasks:\n"
        + '\n---\n'.join(prompt_lines)
        + "\n\nGenerate the plan using ONLY the format above. Be specific, use emojis, and include time blocks."
    )

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[prompt],
            config={
                'temperature': 0.7,
                'max_output_tokens': 1024,
                'top_p': 0.95,
            },
        )
    except Exception as exc:
        logger.exception('Gemini generate-plan failed')
        # Fallback: generate a basic structured plan
        prioritized_tasks = sorted(request.tasks, key=lambda item: item.estimate_hours, reverse=True)
        fallback_plan = "TODAY'S EXECUTION PLAN 🟢\n\n"
        start_hour = 9
        emoji_map = ["⚡", "🔥", "💪", "📌", "🎯"]
        
        for idx, task in enumerate(prioritized_tasks):
            emoji = emoji_map[idx % len(emoji_map)]
            end_hour = start_hour + int(task.estimate_hours)
            fallback_plan += (
                f"{emoji} Priority {idx + 1}\n"
                f"{task.title}\n"
                f"Time: {start_hour:02d}:00-{end_hour:02d}:00\n"
                f"Reason: {task.description[:80]}\n\n"
            )
            start_hour = end_hour + 0.5  # 30 min buffer
        
        fallback_plan += (
            "KEY INSIGHTS:\n"
            "- Tackle the highest-effort items when focus is fresh\n"
            "- Build in buffer time between context switches\n"
            "- If behind schedule, defer lower-priority items\n"
        )
        return {'plan': fallback_plan}

    if not response.candidates:
        logger.error('Gemini generate-plan returned no candidates')
        return {'plan': "TODAY'S EXECUTION PLAN 🟢\n\n⚡ Priority 1\nStart with your highest-impact task\nTime: 09:00-11:00\nReason: Build momentum and protect focus time.\n\n🔥 Priority 2\nWork on the next critical item\nTime: 11:30-13:00\nReason: Dependency or strategic importance.\n\n💪 Priority 3\nFinish supporting tasks\nTime: 14:00-15:30\nReason: Lower priority but still valuable.\n\nKEY INSIGHTS:\n- Focus on one task at a time\n- Use breaks between priorities\n- Adjust if unexpected blockers appear"}

    candidate = response.candidates[0]
    plan_text = ''

    if candidate.content and candidate.content.parts:
        part = candidate.content.parts[0]
        plan_text = getattr(part, 'text', '') or ''

    if not plan_text:
        logger.error('Gemini generate-plan returned no text output')
        return {'plan': "TODAY'S EXECUTION PLAN 🟢\n\n⚡ Priority 1\nStart with your highest-impact task\nTime: 09:00-11:00\nReason: Build momentum and protect focus time.\n\n🔥 Priority 2\nWork on the next critical item\nTime: 11:30-13:00\nReason: Dependency or strategic importance.\n\n💪 Priority 3\nFinish supporting tasks\nTime: 14:00-15:30\nReason: Lower priority but still valuable.\n\nKEY INSIGHTS:\n- Focus on one task at a time\n- Use breaks between priorities\n- Adjust if unexpected blockers appear"}

    return {'plan': plan_text}

@app.post('/api/coach')
def coach(request: CoachRequest):
    completed_tasks = [t for t in request.tasks if t.completed]
    remaining_tasks = [t for t in request.tasks if not t.completed]
    
    completed_lines = [
        f"✓ {task.title} ({task.estimate_hours}h)" for task in completed_tasks
    ] if completed_tasks else ["No tasks completed yet."]
    
    remaining_lines = [
        f"- {task.title} ({task.priority} | {task.estimate_hours}h | Deadline: {task.deadline or 'None'})" for task in remaining_tasks
    ] if remaining_tasks else ["All tasks completed!"]
    
    total_remaining_hours = sum(t.estimate_hours for t in remaining_tasks)
    
    prompt = f"""
You are Momentum AI, an expert productivity strategist.

You are NOT a chatbot.

You continuously analyse the user's work and act like a senior project manager.

Use:
- Task priorities
- Deadlines
- Completed tasks
- Remaining tasks
- Estimated hours
- Available work time

User: {request.username}

Answer the user's question using the task list as context.

Question:
{request.question}
"""

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[prompt],
            config={
                'temperature': 0.7,
                'max_output_tokens': 512,
                'top_p': 0.95,
            },
        )
    except Exception as exc:
        logger.exception('Gemini coach failed')
        return {'response': "I'm temporarily unavailable. Based on your tasks, I recommend finishing the highest priority item first."}

    if not response.candidates:
        logger.error('Gemini coach returned no candidates')
        return {'response': "I'm temporarily unavailable. Based on your tasks, I recommend finishing the highest priority item first."}

    candidate = response.candidates[0]
    coach_text = ''

    if candidate.content and candidate.content.parts:
        part = candidate.content.parts[0]
        coach_text = getattr(part, 'text', '') or ''

    if not coach_text:
        logger.error('Gemini coach returned no text output')
        return {'response': "I'm temporarily unavailable. Based on your tasks, I recommend finishing the highest priority item first."}

    return {'response': coach_text}

@app.post('/api/insight')
def insight(request: InsightRequest):
    if not request.tasks:
        return {'insight': 'Add a task to get a quick AI productivity insight.'}

    completed_tasks = [t for t in request.tasks if t.completed]
    remaining_tasks = [t for t in request.tasks if not t.completed]
    
    if not remaining_tasks:
        return {'insight': '🎉 Amazing! You\'ve completed all tasks. Take a moment to celebrate your momentum!'}

    remaining_hours = sum(t.estimate_hours for t in remaining_tasks)
    high_priority = [t for t in remaining_tasks if t.priority == 'High']
    
    prompt_lines = [
        f"Task: {task.title} ({task.priority} | {task.estimate_hours}h)"
        for task in remaining_tasks
    ]

    prompt = (
        "You are an AI productivity companion. "
        "Review the user's remaining work and provide one concise insight about their progress and workload. "
        "Consider what they've already completed and what's ahead.\n"
        "Give one or two short sentences with a practical, encouraging recommendation.\n\n"
        f"Completed: {len(completed_tasks)} tasks\n"
        f"Remaining: {len(remaining_tasks)} tasks ({remaining_hours:.1f}h)\n"
        f"High Priority Items: {len(high_priority)}\n\n"
        f"User: {request.username}\n\n"
        "Remaining Tasks:\n"
        + '\n---\n'.join(prompt_lines)
        + "\n\nProvide one clear insight."
    )

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[prompt],
            config={
                'temperature': 0.7,
                'max_output_tokens': 80,
                'top_p': 0.95,
            },
        )
    except Exception:
        logger.exception("Gemini insight failed")
        return {
            "insight": "Unable to generate an AI insight right now. Continue with your highest priority task."
        }

    if not response.candidates:
        logger.error("Gemini insight returned no candidates")
        return {
            "insight": "Unable to generate an AI insight right now. Continue with your highest priority task."
        }

    candidate = response.candidates[0]
    insight_text = ""

    if candidate.content and candidate.content.parts:
        part = candidate.content.parts[0]
        insight_text = getattr(part, "text", "") or ""

    if not insight_text:
        logger.error("Gemini insight returned no text output")
        return {
            "insight": "Unable to generate an AI insight right now. Continue with your highest priority task."
        }

    return {"insight": insight_text.strip()}

if __name__ == '__main__':
    import uvicorn

    uvicorn.run(app, host='127.0.0.1', port=8000)
