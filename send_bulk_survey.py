import resend
import os
import csv
import time
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set Resend API key
resend.api_key = os.getenv('RESEND_API_KEY')

if not resend.api_key:
    print("Error: RESEND_API_KEY not found in environment variables")
    exit(1)

# Your template HTML from Resend
TEMPLATE_HTML = """<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" lang="en">
  <head>
    <meta content="width=device-width" name="viewport" />
    <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta content="IE=edge" http-equiv="X-UA-Compatible" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta
      content="telephone=no,address=no,email=no,date=no,url=no"
      name="format-detection" />
  </head>
  <body>
    <table
      border="0"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      role="presentation"
      align="center">
      <tbody>
        <tr>
          <td>
            <table
              align="center"
              width="100%"
              border="0"
              cellpadding="0"
              cellspacing="0"
              role="presentation"
              style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;font-size:1.0769230769230769em;min-height:100%;line-height:155%">
              <tbody>
                <tr>
                  <td>
                    <table
                      align="left"
                      width="100%"
                      border="0"
                      cellpadding="0"
                      cellspacing="0"
                      role="presentation"
                      style="align:left;width:100%;padding-left:0px;padding-right:0px;line-height:155%;max-width:600px;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif">
                      <tbody>
                        <tr>
                          <td>
                            <p
                              class="isSelectedEnd"
                              style="margin:0;padding:0;font-size:1em;padding-top:0.5em;padding-bottom:0.5em">
                              <span>Hi </span>{name}<span>,</span>
                            </p>
                            <p
                              class="isSelectedEnd"
                              style="margin:0;padding:0;font-size:1em;padding-top:0.5em;padding-bottom:0.5em">
                              <span>I am the founder of Context Pack.</span>
                            </p>
                            <p
                              class="isSelectedEnd"
                              style="margin:0;padding:0;font-size:1em;padding-top:0.5em;padding-bottom:0.5em">
                              <span
                                >You signed up recently, and I am trying to
                                understand one thing clearly: </span
                              ><span
                                ><strong
                                  >is Context Pack actually solving a real
                                  problem for you?</strong
                                ></span
                              >
                            </p>
                            <p
                              class="isSelectedEnd"
                              style="margin:0;padding:0;font-size:1em;padding-top:0.5em;padding-bottom:0.5em">
                              <span>I am asking for </span
                              ><span><strong>5 minutes</strong></span
                              ><span> of your time.</span>
                            </p>
                            <p
                              class="isSelectedEnd"
                              style="margin:0;padding:0;font-size:1em;padding-top:0.5em;padding-bottom:0.5em">
                              <span>You can either:</span>
                            </p>
                            <ul
                              style="margin:0;padding:0;padding-left:1.1em;padding-bottom:1em">
                              <li
                                style="margin:0;padding:0;margin-left:1em;margin-bottom:0.3em;margin-top:0.3em">
                                <p
                                  class="isSelectedEnd"
                                  style="margin:0;padding:0">
                                  <span>Fill out the short form below, or</span>
                                </p>
                              </li>
                              <li
                                style="margin:0;padding:0;margin-left:1em;margin-bottom:0.3em;margin-top:0.3em">
                                <p
                                  class="isSelectedEnd"
                                  style="margin:0;padding:0">
                                  <span
                                    >Reply directly to this email with your
                                    thoughts</span
                                  >
                                </p>
                              </li>
                            </ul>
                            <p
                              class="isSelectedEnd"
                              style="margin:0;padding:0;font-size:1em;padding-top:0.5em;padding-bottom:0.5em">
                              <span>As a thank-you, </span
                              ><span
                                ><strong
                                  >we will add 100 free credits</strong
                                ></span
                              ><span> to your account for any response.</span>
                            </p>
                            <p
                              class="isSelectedEnd"
                              style="margin:0;padding:0;font-size:1em;padding-top:0.5em;padding-bottom:0.5em">
                              <span>Our vision for context pack is a </span
                              ><span
                                ><strong
                                  >portable, user-owned memory</strong
                                ></span
                              ><span> tool for AI.</span>
                            </p>
                            <p
                              class="isSelectedEnd"
                              style="margin:0;padding:0;font-size:1em;padding-top:0.5em;padding-bottom:0.5em">
                              <span
                                >The questions are below. Short answers are
                                completely fine.</span
                              >
                            </p>
                            <p
                              style="margin:0;padding:0;font-size:1em;padding-top:0.5em;padding-bottom:0.5em">
                              <span
                                ><a
                                  href="https://forms.gle/TDWMB1SYdJEovJTL7"
                                  rel="noopener noreferrer nofollow"
                                  style="color:#0670DB;text-decoration-line:none;text-decoration:underline"
                                  target="_blank"
                                  >https://forms.gle/TDWMB1SYdJEovJTL7</a
                                ></span
                              >
                            </p>
                            <p
                              style="margin:0;padding:0;font-size:1em;padding-top:0.5em;padding-bottom:0.5em">
                              <span>Thank you for trying Context Pack,</span
                              ><br /><span>Antonio</span><br /><span
                                >Founder, Context Labs LLC</span
                              >
                            </p>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  </body>
</html>"""

def extract_name_from_email(email):
    """
    Extract name from email address.
    If there's a '.' before @, take the first part before the '.'.
    If no '.', take everything before @.
    """
    # Get the part before @
    local_part = email.split('@')[0]
    
    # Check if there's a dot
    if '.' in local_part:
        # Take the first part before the dot
        name = local_part.split('.')[0]
    else:
        # Take the whole local part
        name = local_part
    
    # Capitalize first letter
    return name.capitalize()

def send_email(to_email):
    """Send survey email to a single user"""
    name = extract_name_from_email(to_email)
    
    try:
        # Substitute the {name} variable in the template
        html_content = TEMPLATE_HTML.replace("{name}", name)
        
        params = {
            "from": "Context Pack <context-pack@context-pack.com>",
            "to": [to_email],
            "subject": "Context Pack - Quick 2-minute feedback + Free 100 credits",
            "html": html_content
        }
        
        response = resend.Emails.send(params)
        return True, response['id'], name
        
    except Exception as e:
        return False, str(e), name

def send_bulk_emails(csv_file, delay_seconds=0.5):
    """
    Send emails to all users in the CSV file
    
    Args:
        csv_file: Path to CSV file with email addresses
        delay_seconds: Delay between each email (default 0.5s = 120 emails/min)
    """
    # Read email addresses from CSV
    emails = []
    with open(csv_file, 'r') as f:
        reader = csv.reader(f)
        next(reader)  # Skip header
        for row in reader:
            if row and row[0].strip():  # Skip empty rows
                emails.append(row[0].strip())
    
    total = len(emails)
    print(f"\n{'='*60}")
    print(f"BULK EMAIL CAMPAIGN")
    print(f"{'='*60}")
    print(f"Total recipients: {total}")
    print(f"Rate: {60/delay_seconds:.0f} emails per minute")
    print(f"Estimated time: {(total * delay_seconds) / 60:.1f} minutes")
    print(f"{'='*60}\n")
    
    # Track results
    success_count = 0
    failed_count = 0
    failed_emails = []
    
    # Log files
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    success_log = f"email_success_{timestamp}.log"
    error_log = f"email_errors_{timestamp}.log"
    
    start_time = time.time()
    
    # Send emails
    for i, email in enumerate(emails, 1):
        success, result, name = send_email(email)
        
        if success:
            success_count += 1
            # Log success
            with open(success_log, 'a') as f:
                f.write(f"{email},{name},{result}\n")
            print(f"[{i}/{total}] ✓ {email} (name: {name}) - ID: {result}")
        else:
            failed_count += 1
            failed_emails.append((email, result))
            # Log error
            with open(error_log, 'a') as f:
                f.write(f"{email},{name},{result}\n")
            print(f"[{i}/{total}] ✗ {email} - Error: {result}")
        
        # Progress update every 10 emails
        if i % 10 == 0:
            elapsed = time.time() - start_time
            rate = i / elapsed
            remaining = (total - i) / rate if rate > 0 else 0
            print(f"\n--- Progress: {i}/{total} ({i/total*100:.1f}%) | Success: {success_count} | Failed: {failed_count} | ETA: {remaining/60:.1f} min ---\n")
        
        # Rate limiting - delay between sends
        if i < total:  # Don't delay after the last email
            time.sleep(delay_seconds)
    
    # Final summary
    elapsed_time = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"CAMPAIGN COMPLETE")
    print(f"{'='*60}")
    print(f"Total sent: {total}")
    print(f"✓ Successful: {success_count}")
    print(f"✗ Failed: {failed_count}")
    print(f"Time elapsed: {elapsed_time/60:.2f} minutes")
    print(f"Average rate: {total/elapsed_time*60:.1f} emails/minute")
    print(f"\nLogs saved:")
    print(f"  Success: {success_log}")
    if failed_count > 0:
        print(f"  Errors: {error_log}")
        print(f"\nFailed emails:")
        for email, error in failed_emails[:10]:  # Show first 10
            print(f"  - {email}: {error}")
        if len(failed_emails) > 10:
            print(f"  ... and {len(failed_emails) - 10} more (see {error_log})")
    print(f"{'='*60}\n")

if __name__ == "__main__":
    # Send to all users in the CSV
    send_bulk_emails("users_credits_not_10.csv", delay_seconds=0.5)
