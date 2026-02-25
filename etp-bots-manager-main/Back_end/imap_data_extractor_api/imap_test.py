import imaplib

email = "mendrikaja@outlook.fr"
password = "R@her1ar1s0n57"

try:
    imap = imaplib.IMAP4_SSL("outlook.office365.com", 993)
    imap.login(email, password)
    print("LOGIN OK")
    imap.logout()
except Exception as e:
    print("ERREUR:", e)