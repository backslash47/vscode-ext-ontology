
class Contract:

    @property
    def Script(self):
        """

        :return:
        """
        return GetScript(self)

    @property
    def StorageContext(self):
        """

        :return:
        """
        return GetStorageContext(self)


def GetStorageContext(contract):
    """

    :param contract:
    """
    pass


def Destroy():
    """

    :param contract:
    """
    pass


def Migrate(code, needStorage, name, version, author, email, description):
    """

    :param contract:
    """
    pass
