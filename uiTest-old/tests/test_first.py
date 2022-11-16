# from selenium import webdriver
# from selenium.webdriver.common.by import By
# from selenium.webdriver.support.wait import WebDriverWait
# from selenium.webdriver.support import expected_conditions as EC

# driver = webdriver.Remote('http://localhost:4723/wd/hub', {
#     'platformName': 'Android',
#     'deviceName': 'emulator-5554',
#     'browserName': 'Chrome'
# })
# driver.get('http://saucelabs.com/test/guinea-pig')
# # div = driver.find_element('id', 'i_am_an_id')
# # assert "I am a div" in div.text
# # driver.find_element('id', 'your_comments').send_keys('My comment')
# # driver.quit()

# try:
#     div = WebDriverWait(driver, 10).until(
#         EC.presence_of_element_located((By.ID, "i_am_an_id"))
#     )
#     assert "I am a div" in div.text
# finally:
#     driver.quit()


from selenium import webdriver
from selenium.webdriver.common.keys import Keys


def test_greeting():
    url = "http://127.0.0.1:4723/wd/hub"
    desired_capabilities = {}
    driver = webdriver.Remote(
        command_executor=f'{url}', desired_capabilities=desired_capabilities)

    driver.get("http://www.python.org")
    assert "Python" in driver.title
    elem = driver.find_element('name', 'q')
    elem.clear()
    elem.send_keys("pycon")
    elem.send_keys(Keys.RETURN)
    assert "No results found." not in driver.page_source
    driver.quit()
