import nose
from flask_testing import LiveServerTestCase
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure

from server.animus import app
from server.tests.player_browser import Player


class AnimusTest(LiveServerTestCase):
    player_one = None
    player_two = None

    def create_app(self):
        self.app = app.test_client()
        self.app.testing = True
        return app

    @classmethod
    def setUpClass(cls):
        cls.mongo_client = MongoClient()
        cls.game_name = "testGame"
        try:
            cls.mongo_client.admin.command('ismaster')
            cls.mongo_client.animus.game.remove({"name": "{0}".format(cls.game_name)})
        except ConnectionFailure:
            print("Mongodb server not available")
            exit(1)

        cls.player_one = Player('player_one')
        cls.player_two = Player('player_two')

    @classmethod
    def tearDownClass(cls):
        cls.player_one.driver.quit()
        cls.player_two.driver.quit()

    def test_create_game_with_new_users(self):
        self.player_one.login_new_user()
        self.player_two.login_new_user()

        self.assertIn(self.player_one.player_name, self.player_one.login_get_welcome_text(), msg="player 1 login works")
        self.assertIn(self.player_two.player_name, self.player_two.login_get_welcome_text(), msg="player 2 login works")

        self.player_one.create_game(self.game_name)
        self.assertIn('lobby', self.player_one.driver.current_url, msg="game created, player 1 in lobby")
        game_joined = self.player_two.join_game(self.game_name)
        self.assertTrue(game_joined, msg="game joined")


if __name__ == "__main__":
    nose.main()
