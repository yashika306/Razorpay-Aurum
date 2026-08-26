import time
import random
import logging
from typing import Tuple
from core.models import Transaction, Diagnosis, ExecutionStatus

logger = logging.getLogger(__name__)

def send_recovery_notification(
    transaction: Transaction, 
    diagnosis: Diagnosis, 
    tone: str = "gentle",
    use_hinglish: bool = False
) -> Tuple[ExecutionStatus, str]:
    """
    Simulates sending a recovery message (WhatsApp/SMS/Email) to the customer.
    Formulates context-specific content in English or Hinglish.
    
    Returns:
        Tuple[ExecutionStatus, logs]
    """
    logger.info(f"Sending recovery notification for Txn: {transaction.txn_id}, Tone: {tone}, Hinglish: {use_hinglish}")
    
    # Simulate API call latency to Twilio / WhatsApp Business / SendGrid
    time.sleep(0.2)
    
    channel = "WhatsApp"
    if transaction.type.value == "invoice":
        channel = "Email"
    elif transaction.type.value == "payment":
        channel = "SMS"
        
    payment_link = f"https://rzp.io/i/rec_{transaction.txn_id[:6]}"
    message_content = ""
    
    if transaction.type.value == "invoice":
        # B2B Invoice reminder tone escalation
        if tone == "gentle":
            message_content = (
                f"Subject: Friendly Reminder: Invoice {transaction.txn_id} from Razorpay Merchant\n\n"
                f"Hi {transaction.customer_name},\n"
                f"Hope you are doing well! Just a friendly reminder that Invoice {transaction.txn_id} "
                f"for INR {transaction.amount:,.2f} is pending. You can quickly complete your payment "
                f"using this link: {payment_link}\n"
                f"Thank you!"
            )
        elif tone == "firm":
            message_content = (
                f"Subject: Overdue Notice: Invoice {transaction.txn_id} - Payment Required\n\n"
                f"Dear {transaction.customer_name},\n"
                f"This is to remind you that the payment of INR {transaction.amount:,.2f} for Invoice "
                f"{transaction.txn_id} is overdue. Please settle this payment immediately via: {payment_link} "
                f"to prevent any service disruption.\n"
                f"Regards,\nFinance Team"
            )
        else: # Final notice / Escalate
            message_content = (
                f"Subject: URGENT: Final Notice for Invoice {transaction.txn_id}\n\n"
                f"Dear {transaction.customer_name},\n"
                f"Despite multiple reminders, the payment of INR {transaction.amount:,.2f} remains unpaid. "
                f"This account is being escalated to human recovery ops today. "
                f"Please settle the invoice immediately here: {payment_link} to halt collection proceedings."
            )
            
    elif transaction.type.value in ["checkout", "payment"]:
        # E-commerce Checkout Drop-off or general payment failure
        if use_hinglish:
            # High-conversion Hinglish SMS/WhatsApp message
            if transaction.type.value == "checkout":
                message_content = (
                    f"Hey {transaction.customer_name}! your cart is waiting for you! 🛒\n"
                    f"INR {transaction.amount:,.2f} ki shopping bas ek click door hai. "
                    f"Apne order ko pura karne ke liye abhi click karein: {payment_link}. "
                    f"Koi help chahiye ho toh reply karein!"
                )
            else: # Payment failure
                message_content = (
                    f"Hello {transaction.customer_name}, aapka payment fail ho gaya tha. 😟\n"
                    f"INR {transaction.amount:,.2f} ki transaction complete nahi ho payi due to: {diagnosis.root_cause}.\n"
                    f"Don't worry, aap is direct link se firse try kar sakte hain: {payment_link}"
                )
        else:
            # Standard English messaging
            if transaction.type.value == "checkout":
                message_content = (
                    f"Hello {transaction.customer_name},\n"
                    f"We noticed you left some items in your cart. Complete your purchase of "
                    f"INR {transaction.amount:,.2f} using your secure checkout link: {payment_link}\n"
                    f"We've reserved your cart for the next 24 hours!"
                )
            else: # Payment failure
                message_content = (
                    f"Hello {transaction.customer_name},\n"
                    f"Your payment of INR {transaction.amount:,.2f} failed due to: {diagnosis.root_cause}.\n"
                    f"To complete your purchase, please secure retry via this payment link: {payment_link}"
                )
                
    elif transaction.type.value == "subscription":
        # Subscription payment failure
        message_content = (
            f"Hello {transaction.customer_name},\n"
            f"We were unable to process your recurring subscription payment of INR {transaction.amount:,.2f} "
            f"due to: {diagnosis.root_cause}.\n"
            f"Please update your payment mandate details or retry manually here: {payment_link}"
        )

    logs = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Dispatched via {channel} to {transaction.customer_phone or transaction.customer_email}:\n"
    logs += f"\"\"\"\n{message_content}\n\"\"\"\n"
    logs += "Status: Delivered successfully."
    
    # 95% delivery success rate simulation
    status = ExecutionStatus.SUCCESS if random.random() < 0.95 else ExecutionStatus.FAILED
    if status == ExecutionStatus.FAILED:
        logs += " Error: SMTP/Carrier Gateway Timeout."
        
    return status, logs

def send_ivr_voice_call(transaction: Transaction, diagnosis: Diagnosis) -> Tuple[ExecutionStatus, str]:
    """
    Simulates placing an outbound IVR voice call using Hinglish Text-to-Speech script.
    """
    logger.info(f"Placing outbound Hinglish IVR voice call for Txn: {transaction.txn_id}")
    time.sleep(0.2)
    
    script = (
        f"Namaste {transaction.customer_name}! Main Sageant Autonomous Voice Assist se bol rahi hoon. "
        f"Aapka payment fail ho gaya tha. Aapki Rs {transaction.amount:,.2f} ki billing hum complete nahi kar paye, "
        f"due to: {diagnosis.root_cause}. Agar aap abhi ise pay karna chahte hain toh direct link check karein jo humne WhatsApp par bheji hai. "
        f"Dhanyawaad!"
    )
    
    logs = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Initiating Exotel Outbound Voice Call to {transaction.customer_phone}...\n"
    logs += "Dialer Status: Connected.\n"
    logs += f"Playing TTS Hinglish script:\n"
    logs += f"\"\"\"\n{script}\n\"\"\"\n"
    logs += "Outbound Call Completed (Duration: 35s)."
    
    return ExecutionStatus.SUCCESS, logs

